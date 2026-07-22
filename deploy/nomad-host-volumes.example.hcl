# Fragmento SOLO de host volumes — integrar DENTRO del bloque client { } existente.
# No pegar como archivo suelto si ya tienes client { enabled = true ... } en otro .hcl:
# copia las tres entradas host_volume adentro de ese bloque.
#
# Referencia completa: deploy/nomad-client.example.hcl
#
# Datos persistentes en /logs (~150 GB disponibles en el nodo).
# MinIO: reservar ≥80 GB en /logs/insular/intranet/minio para documentos y adjuntos.

client {
  host_volume "insular-sqlserver-data" {
    path      = "/logs/insular/intranet/sqlserver"
    read_only = false
  }

  host_volume "insular-minio-data" {
    path      = "/logs/insular/intranet/minio"
    read_only = false
    # Asegurar ≥80 GB libres en la partición de /logs para este directorio.
  }

  host_volume "insular-redis-data" {
    path      = "/logs/insular/intranet/redis"
    read_only = false
  }
}

# Crear directorios en el host (una sola vez):
#   sudo mkdir -p /logs/insular/intranet/{sqlserver,minio,redis}
#   sudo chown -R 1000:1000 /logs/insular/intranet/minio
#   sudo chown -R 999:999 /logs/insular/intranet/redis
# SQL Server usa mssql (uid 10001) internamente; Nomad montará el volumen con permisos del host.
