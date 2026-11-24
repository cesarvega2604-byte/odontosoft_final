[CmdletBinding(DefaultParameterSetName = 'Copia')]
param(
    [Parameter(Mandatory)] [string] $Servidor,
    [ValidateRange(1, 65535)] [int] $Puerto = 5432,
    [Parameter(Mandatory)] [string] $Usuario,
    [Parameter(Mandatory)] [string] $BaseOrigen,
    [Parameter(Mandatory)] [string] $Archivo,
    [string] $BinPostgreSQL = '',
    [Parameter(Mandatory, ParameterSetName = 'Restauracion')]
    [ValidatePattern('^odontosoft_restore_[a-z0-9_]{1,37}$')]
    [string] $BaseDestino,
    [Parameter(Mandatory, ParameterSetName = 'Restauracion')]
    [ValidatePattern('^[A-Fa-f0-9]{64}$')]
    [string] $Sha256
)

$ErrorActionPreference = 'Stop'
$Conexion = @('--host', $Servidor, '--port', $Puerto, '--username', $Usuario, '--no-password')
$RutaArchivo = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Archivo)

function Invoke-Postgres([string] $Programa, [string[]] $Argumentos) {
    $Ejecutable = if ($BinPostgreSQL) { Join-Path $BinPostgreSQL "$Programa.exe" } else { $Programa }
    & $Ejecutable @Argumentos
    if ($LASTEXITCODE -ne 0) {
        throw "$Programa falló con código $LASTEXITCODE."
    }
}

if ($PSCmdlet.ParameterSetName -eq 'Copia') {
    if (Test-Path -LiteralPath $RutaArchivo) {
        throw 'El archivo de respaldo ya existe.'
    }
    $Carpeta = Split-Path -Parent $RutaArchivo
    if (-not (Test-Path -LiteralPath $Carpeta -PathType Container)) {
        throw 'La carpeta de destino debe existir.'
    }
    $Temporal = Join-Path $Carpeta ('.odontosoft-' + [guid]::NewGuid().ToString('N') + '.tmp')
    try {
        Invoke-Postgres 'pg_dump' ($Conexion + @('--dbname', $BaseOrigen, '--format=custom', '--file', $Temporal))
        Invoke-Postgres 'pg_restore' @('--list', $Temporal) | Out-Null
        [IO.File]::Move($Temporal, $RutaArchivo)
    } finally {
        if (Test-Path -LiteralPath $Temporal -PathType Leaf) {
            Remove-Item -LiteralPath $Temporal
        }
    }
    Get-FileHash -LiteralPath $RutaArchivo -Algorithm SHA256
    return
}

if ($BaseOrigen -ieq $BaseDestino) {
    throw 'Usa una base de restauración distinta del origen.'
}
$ArchivoVerificado = Get-FileHash -LiteralPath $RutaArchivo -Algorithm SHA256
if ($ArchivoVerificado.Hash -ine $Sha256) {
    throw 'La huella SHA-256 del archivo no coincide con el registro del respaldo.'
}
Invoke-Postgres 'createdb' ($Conexion + @('--maintenance-db=postgres', '--template=template0', '--', $BaseDestino))
Invoke-Postgres 'pg_restore' ($Conexion + @('--dbname', $BaseDestino, '--single-transaction', '--no-owner', '--no-privileges', $RutaArchivo))
Invoke-Postgres 'psql' ($Conexion + @('--no-psqlrc', '--dbname', $BaseDestino, '--set=ON_ERROR_STOP=1',
    '--file', (Join-Path $PSScriptRoot 'verificar_restauracion.sql')))
Write-Output "Restauración comprobada en $BaseDestino."
