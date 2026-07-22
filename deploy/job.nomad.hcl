# Insular Intranet — Nomad (nodo dedicado pool intranet).
#
# Un grupo Nomad por componente (allocations independientes, red host):
#   1. database  → SQL Server
#   2. minio     → espera :1433, luego MinIO
#   3. redis     → espera :9000, luego Redis
#   4. api       → espera :6379, luego API (+ entrypoint espera SQL/MinIO/Redis)
#   5. web       → frontend (+ entrypoint espera /api/v1/health)
#
# CI sustituye INSULAR_PLACEHOLDER_JOB por el ID del job antes de `nomad job run`.
#
# Whitelist IP (solo prod): ipAllowList vía Traefik file provider. Nomad enlaza @file si
# traefik_ip_allowlist_enabled=true (CI: TRAEFIK_IP_ALLOWLIST no vacío en deploy:nomad-prod).
# Requisito: cargar deploy/traefik/dynamic-insular-intranet-ipallowlist.yml en Traefik
# (middlewares insular-intranet-prod-custom-error-page e insular-intranet-prod-ipallowlist).
# Cadena Nomad: custom-error-page antes que ipallowlist (errors captura el 403 del allowlist).

variable "env_file_path" {
  type        = string
  description = "Ruta al .env de producción (variable File GitLab PROD_ENV_FILE)."
}

variable "wait_tcp_script_path" {
  type        = string
  description = "Ruta absoluta a deploy/scripts/wait-tcp.sh (la pasa deploy.sh)."
}

variable "image_api" {
  type        = string
  description = "Imagen API (registry.devtechspace.com/insular/intranet-api:tag)."
}

variable "image_frontend" {
  type        = string
  description = "Imagen front nginx (registry.devtechspace.com/insular/intranet-front:tag)."
}

variable "registry_user" {
  type    = string
  default = ""
}

variable "registry_token" {
  type    = string
  default = ""
}

variable "datacenter" {
  type    = string
  default = "dcprod"
}

variable "node_pool" {
  type    = string
  default = "intranet"
}

variable "traefik_host" {
  type    = string
  default = "intranet.insularcambios.com"
}

variable "traefik_router" {
  type    = string
  default = "insular-intranet-front-prod"
}

variable "traefik_entrypoint" {
  type    = string
  default = "websecure"
}

variable "traefik_certresolver" {
  type    = string
  default = "godaddy"
}

variable "web_http_port" {
  type        = number
  default     = 8080
  description = "Puerto HTTP fijo del front en el nodo (host network). Abrir en firewall desde Traefik."
}

variable "traefik_backend_url" {
  type        = string
  default     = "http://172.28.163.12:8080"
  description = "URL explícita del backend para Traefik (loadbalancer.server.url)."
}

variable "traefik_extra_tags" {
  type        = list(string)
  description = "Etiquetas Traefik extra (p. ej. serversTransport@file)."
  default     = []
}

# ipAllowList vía Traefik file provider (una sola definición). Nomad solo enlaza @file para evitar
# conflicto con réplicas (mismo middleware inline en N allocations → "defined multiple times").
variable "traefik_ip_allowlist_enabled" {
  type        = bool
  description = "Si true, el router usa middleware insular-intranet-<environment>-ipallowlist@file."
  default     = false
}

variable "smtp_relay_ip" {
  type        = string
  default     = "172.28.163.15"
  description = "IP del relay Postal (conexión TCP directa; evita DNS en red host)."
}

variable "api_extra_hosts" {
  type        = list(string)
  default     = ["send.insularcambios.com:172.28.163.15"]
  description = "extra_hosts del contenedor API (/etc/hosts). SMTP relay en otro nodo."
}

variable "service_name" {
  type        = string
  description = "Prefijo de servicios Nomad (API = service_name-api)."
  default     = "insular-intranet"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "api_service_name" {
  type        = string
  description = "Nombre del service Nomad de la API."
  default     = "insular-intranet-api"
}

variable "sql_service_name" {
  type    = string
  default = "insular-intranet-sql"
}

variable "minio_service_name" {
  type    = string
  default = "insular-intranet-minio"
}

variable "redis_service_name" {
  type    = string
  default = "insular-intranet-redis"
}

locals {
  traefik_base_tags = [
    "traefik.enable=true",
    "traefik.http.routers.${var.traefik_router}.rule=Host(`${var.traefik_host}`)",
    "traefik.http.routers.${var.traefik_router}.entrypoints=${var.traefik_entrypoint}",
    "traefik.http.routers.${var.traefik_router}.tls=true",
    "traefik.http.routers.${var.traefik_router}.tls.certresolver=${var.traefik_certresolver}",
    "traefik.http.services.${var.traefik_router}.loadbalancer.passHostHeader=true",
    "traefik.http.services.${var.traefik_router}.loadbalancer.server.url=${var.traefik_backend_url}",
  ]

  traefik_ipallowlist_file_mw  = "insular-intranet-${var.environment}-ipallowlist"
  traefik_custom_error_file_mw = "insular-intranet-${var.environment}-custom-error-page"

  traefik_whitelist_tags = var.traefik_ip_allowlist_enabled ? [
    "traefik.http.routers.${var.traefik_router}.middlewares=${local.traefik_custom_error_file_mw}@file,${local.traefik_ipallowlist_file_mw}@file",
  ] : []

  traefik_tags_all = concat(local.traefik_base_tags, local.traefik_whitelist_tags, var.traefik_extra_tags)
}

job "INSULAR_PLACEHOLDER_JOB" {
  region      = "global"
  datacenters = [var.datacenter]
  type        = "service"
  node_pool   = var.node_pool

  constraint {
    attribute = "${meta.pool}"
    value     = "intranet"
  }

  constraint {
    attribute = "${meta.env}"
    value     = "intra"
  }

  constraint {
    attribute = "${meta.role}"
    value     = "worker"
  }

  # ---------------------------------------------------------------------------
  # 1) SQL Server
  # ---------------------------------------------------------------------------
  group "database" {
    count = 1

    update {
      max_parallel      = 1
      health_check      = "task_states"
      min_healthy_time  = "60s"
      healthy_deadline  = "45m"
      progress_deadline = "50m"
      auto_revert       = true
    }

    network {
      mode = "host"

      port "sql" {
        static = 1433
      }
    }

    volume "sqlserver_data" {
      type      = "host"
      source    = "insular-sqlserver-data"
      read_only = false
    }

    task "sqlserver" {
      driver = "docker"

      restart {
        attempts = 5
        interval = "30m"
        delay    = "30s"
        mode     = "delay"
      }

      env {
        ACCEPT_EULA = "Y"
        MSSQL_PID   = "Express"
        TZ          = "America/Caracas"
      }

      template {
        data        = file(var.env_file_path)
        destination = "local/stack.env"
        env         = true
      }

      config {
        image = "mcr.microsoft.com/mssql/server:2022-CU16-ubuntu-22.04"
        ports = ["sql"]
      }

      volume_mount {
        volume      = "sqlserver_data"
        destination = "/var/opt/mssql"
        read_only   = false
      }

      resources {
        cpu    = 1500
        memory = 4096
      }

      service {
        name         = var.sql_service_name
        port         = "sql"
        provider     = "nomad"
        address_mode = "host"

        check {
          type     = "tcp"
          port     = "sql"
          interval = "15s"
          timeout  = "5s"

          check_restart {
            grace = "900s"
            limit = 0
          }
        }
      }
    }
  }

  # ---------------------------------------------------------------------------
  # 2) MinIO — prestart espera SQL :1433
  # ---------------------------------------------------------------------------
  group "minio" {
    count = 1

    update {
      max_parallel      = 1
      health_check      = "task_states"
      min_healthy_time  = "20s"
      healthy_deadline  = "45m"
      progress_deadline = "50m"
      auto_revert       = false
    }

    network {
      mode = "host"

      port "minio" {
        static = 9000
      }
    }

    volume "minio_data" {
      type      = "host"
      source    = "insular-minio-data"
      read_only = false
      # Reservar ~80 GB en el host para /logs/insular/intranet/minio (ver README).
    }

    task "wait-sql" {
      driver = "docker"

      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      template {
        data = <<EOH
{{- range nomadService "${var.sql_service_name}" -}}
WAIT_HOST={{ .Address }}
WAIT_PORT={{ .Port }}
{{- end }}
EOH
        destination = "local/wait-target.env"
        env         = true

        wait {
          min = "10s"
          max = "1200s"
        }
      }

      template {
        data        = file(var.wait_tcp_script_path)
        destination = "local/wait-tcp.sh"
        perms       = "0755"
      }

      config {
        image      = "alpine:3.20"
        entrypoint = ["/bin/sh", "-c"]
        args       = ["exec /local/wait-tcp.sh \"$${WAIT_HOST}\" \"$${WAIT_PORT}\" 240 5 /bin/true"]
      }

      resources {
        cpu    = 50
        memory = 64
      }
    }

    task "minio" {
      driver = "docker"

      template {
        data        = file(var.env_file_path)
        destination = "local/stack.env"
        env         = true
      }

      template {
        data = <<EOH
{{ with env "MINIO_ACCESS_KEY" -}}
MINIO_ROOT_USER={{ . }}
{{- end }}
{{ with env "MINIO_SECRET_KEY" -}}
MINIO_ROOT_PASSWORD={{ . }}
{{- end }}
EOH
        destination = "local/minio.env"
        env         = true
      }

      config {
        image   = "minio/minio:RELEASE.2024-12-18T13-15-44Z"
        command = "server"
        args    = ["/data", "--address", ":9000", "--console-address", ":9001"]
        ports   = ["minio"]
      }

      volume_mount {
        volume      = "minio_data"
        destination = "/data"
        read_only   = false
      }

      resources {
        cpu    = 200
        memory = 512
      }

      service {
        name         = var.minio_service_name
        port         = "minio"
        provider     = "nomad"
        address_mode = "host"

        check {
          type     = "tcp"
          port     = "minio"
          interval = "10s"
          timeout  = "3s"
        }
      }
    }
  }

  # ---------------------------------------------------------------------------
  # 3) Redis — prestart espera MinIO :9000
  # ---------------------------------------------------------------------------
  group "redis" {
    count = 1

    update {
      max_parallel      = 1
      health_check      = "task_states"
      min_healthy_time  = "20s"
      healthy_deadline  = "45m"
      progress_deadline = "50m"
      auto_revert       = false
    }

    network {
      mode = "host"

      port "redis" {
        static = 6379
      }
    }

    volume "redis_data" {
      type      = "host"
      source    = "insular-redis-data"
      read_only = false
    }

    task "wait-minio" {
      driver = "docker"

      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      template {
        data = <<EOH
{{- range nomadService "${var.minio_service_name}" -}}
WAIT_HOST={{ .Address }}
WAIT_PORT={{ .Port }}
{{- end }}
EOH
        destination = "local/wait-target.env"
        env         = true

        wait {
          min = "5s"
          max = "600s"
        }
      }

      template {
        data        = file(var.wait_tcp_script_path)
        destination = "local/wait-tcp.sh"
        perms       = "0755"
      }

      config {
        image      = "alpine:3.20"
        entrypoint = ["/bin/sh", "-c"]
        args       = ["exec /local/wait-tcp.sh \"$${WAIT_HOST}\" \"$${WAIT_PORT}\" 240 5 /bin/true"]
      }

      resources {
        cpu    = 50
        memory = 64
      }
    }

    task "redis" {
      driver = "docker"

      template {
        data        = file(var.env_file_path)
        destination = "local/stack.env"
        env         = true
      }

      template {
        data = <<EOH
dir /data
appendonly yes
{{ with env "REDIS_PASSWORD" -}}
requirepass {{ . }}
{{- end }}
EOH
        destination = "local/redis.conf"
      }

      config {
        image = "redis:7-alpine"
        args  = ["redis-server", "/local/redis.conf"]
        ports = ["redis"]
      }

      volume_mount {
        volume      = "redis_data"
        destination = "/data"
        read_only   = false
      }

      resources {
        cpu    = 100
        memory = 256
      }

      service {
        name         = var.redis_service_name
        port         = "redis"
        provider     = "nomad"
        address_mode = "host"

        check {
          type     = "tcp"
          port     = "redis"
          interval = "10s"
          timeout  = "3s"
        }
      }
    }
  }

  # ---------------------------------------------------------------------------
  # 4) API — prestart espera Redis :6379; entrypoint valida SQL/MinIO/Redis
  # ---------------------------------------------------------------------------
  group "api" {
    count = 1

    update {
      max_parallel      = 1
      health_check      = "task_states"
      min_healthy_time  = "30s"
      healthy_deadline  = "45m"
      progress_deadline = "50m"
      auto_revert       = false
    }

    network {
      mode = "host"

      port "http" {
        static = 3000
      }
    }

    task "wait-redis" {
      driver = "docker"

      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      template {
        data = <<EOH
{{- range nomadService "${var.redis_service_name}" -}}
WAIT_HOST={{ .Address }}
WAIT_PORT={{ .Port }}
{{- end }}
EOH
        destination = "local/wait-target.env"
        env         = true

        wait {
          min = "5s"
          max = "600s"
        }
      }

      template {
        data        = file(var.wait_tcp_script_path)
        destination = "local/wait-tcp.sh"
        perms       = "0755"
      }

      config {
        image      = "alpine:3.20"
        entrypoint = ["/bin/sh", "-c"]
        args       = ["exec /local/wait-tcp.sh \"$${WAIT_HOST}\" \"$${WAIT_PORT}\" 240 5 /bin/true"]
      }

      resources {
        cpu    = 50
        memory = 64
      }
    }

    task "api" {
      driver = "docker"

      restart {
        attempts = 10
        interval = "30m"
        delay    = "30s"
        mode     = "delay"
      }

      template {
        data        = file(var.env_file_path)
        destination = "local/app.env"
        env         = true
      }

      template {
        data = <<EOH
{{ range nomadService "${var.sql_service_name}" }}
DB_SERVER={{ .Address }}
{{ end }}
{{ range nomadService "${var.minio_service_name}" }}
MINIO_ENDPOINT={{ .Address }}
{{ end }}
{{ range nomadService "${var.redis_service_name}" }}
REDIS_HOST={{ .Address }}
{{ end }}
EOH
        destination = "local/service-hosts.env"
        env         = true

        wait {
          min = "5s"
          max = "600s"
        }
      }

      template {
        data = <<EOH
SMTP_CONNECT_HOST=${var.smtp_relay_ip}
EOH
        destination = "local/smtp-relay.env"
        env         = true
      }

      env {
        TZ                = "America/Caracas"
        NODE_ENV          = "production"
        REDIS_ENABLED     = "true"
        MINIO_ENABLED     = "true"
        DB_WAIT_ATTEMPTS  = "240"
        DB_WAIT_SLEEP_SEC = "5"
      }

      config {
        image          = var.image_api
        ports          = ["http"]
        extra_hosts    = var.api_extra_hosts
        auth_soft_fail = true

        auth {
          username = var.registry_user
          password = var.registry_token
        }

        labels {
          service_name = var.service_name
          environment  = var.environment
        }
      }

      resources {
        cpu    = 500
        memory = 1024
      }

      service {
        name         = var.api_service_name
        port         = "http"
        provider     = "nomad"
        address_mode = "host"

        check {
          type     = "http"
          path     = "/api/v1/health"
          port     = "http"
          interval = "15s"
          timeout  = "5s"
        }
      }
    }
  }

  # ---------------------------------------------------------------------------
  # 5) Front — puerto fijo + URL explícita para Traefik remoto (172.28.163.3)
  # ---------------------------------------------------------------------------
  group "web" {
    count = 1

    update {
      max_parallel      = 1
      health_check      = "task_states"
      min_healthy_time  = "20s"
      healthy_deadline  = "45m"
      progress_deadline = "50m"
      auto_revert       = false
    }

    network {
      mode = "host"

      port "http" {
        static = var.web_http_port
      }
    }

    task "wait-api" {
      driver = "docker"

      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      template {
        data = <<EOH
{{- range nomadService "${var.api_service_name}" -}}
WAIT_HOST={{ .Address }}
WAIT_PORT={{ .Port }}
{{- end }}
EOH
        destination = "local/wait-target.env"
        env         = true

        wait {
          min = "5s"
          max = "600s"
        }
      }

      template {
        data        = file(var.wait_tcp_script_path)
        destination = "local/wait-tcp.sh"
        perms       = "0755"
      }

      config {
        image      = "alpine:3.20"
        entrypoint = ["/bin/sh", "-c"]
        args       = ["exec /local/wait-tcp.sh \"$${WAIT_HOST}\" \"$${WAIT_PORT}\" 240 5 /bin/true"]
      }

      resources {
        cpu    = 50
        memory = 64
      }
    }

    task "frontend" {
      driver = "docker"

      restart {
        attempts = 10
        interval = "30m"
        delay    = "20s"
        mode     = "delay"
      }

      template {
        data = <<EOH
{{ range nomadService "${var.api_service_name}" }}
BACKEND_ORIGIN=http://{{ .Address }}:{{ .Port }}
{{ end }}
EOH
        destination = "local/frontend.env"
        env         = true

        wait {
          min = "5s"
          max = "600s"
        }
      }

      env {
        TZ = "America/Caracas"
      }

      config {
        image          = var.image_frontend
        ports          = ["http"]
        auth_soft_fail = true

        auth {
          username = var.registry_user
          password = var.registry_token
        }

        labels {
          service_name = "${var.service_name}-front"
          environment  = var.environment
        }
      }

      resources {
        cpu    = 100
        memory = 128
      }

      service {
        name         = var.traefik_router
        port         = "http"
        provider     = "nomad"
        address_mode = "host"

        tags = local.traefik_tags_all

        check {
          type     = "http"
          path     = "/health"
          port     = "http"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}
