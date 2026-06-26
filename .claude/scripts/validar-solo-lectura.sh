#!/bin/bash
# validar-solo-lectura.sh
# Bloquea operaciones de ESCRITURA en SQL; permite solo lectura (SELECT).
# Usado como hook PreToolUse por el agente verificador-datos.
# Lee el comando que Claude va a ejecutar (Bash o consulta SQL) y, si detecta una
# operación de escritura, sale con código 2 para BLOQUEARLA.

# Leer el JSON que Claude pasa por stdin
INPUT=$(cat)

# Extraer el comando (Bash usa .command; algunas herramientas SQL usan .query)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // .tool_input.query // empty')

if [ -z "$CMD" ]; then
  exit 0
fi

# Bloquear operaciones de escritura (sin distinguir mayúsculas/minúsculas)
if echo "$CMD" | grep -iE '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE)\b' > /dev/null; then
  echo "BLOQUEADO: el verificador es de solo lectura. Solo se permiten consultas SELECT. Si necesitas escribir en Supabase, hazlo desde la sesión principal con confirmación explícita." >&2
  exit 2
fi

exit 0
