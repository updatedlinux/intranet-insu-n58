# Ejemplo completo de cliente Nomad — pool intranet (nodo 172.28.163.12).
# Los host_volume DEBEN ir DENTRO de client { }, no al mismo nivel que datacenter.

datacenter = "dcprod"
# Estado de Nomad (allocs, logs de agente) en /logs — no llenar lvroot (10 GB).
data_dir   = "/logs/nomad/data"
bind_addr  = "0.0.0.0"

advertise {
  http = "172.28.163.12" # .5, .6, .7 según el nodo
  rpc  = "172.28.163.12"
  serf = "172.28.163.12"
}

client {
  enabled = true
  servers = ["172.28.163.2:4647"]

  node_pool = "intranet"

  meta {
    role = "worker"
    env  = "intra"
    pool = "intranet"
  }

  # Datos persistentes de la intranet (disco /logs)
  host_volume "insular-sqlserver-data" {
    path      = "/logs/insular/intranet/sqlserver"
    read_only = false
  }

  host_volume "insular-minio-data" {
    path      = "/logs/insular/intranet/minio"
    read_only = false
    # Reservar ≥80 GB en la partición de /logs para documentos y adjuntos.
  }

  host_volume "insular-redis-data" {
    path      = "/logs/insular/intranet/redis"
    read_only = false
  }
}

plugin "docker" {
  config {
    volumes {
      enabled      = true
      selinuxlabel = "z"
    }
  }
}

telemetry {
  collection_interval        = "1s"
  disable_hostname           = true
  publish_allocation_metrics = true
  publish_node_metrics       = true
}
