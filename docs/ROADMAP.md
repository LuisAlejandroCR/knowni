<!-- docs/ROADMAP.md -->
Qué sigue, ordenado por riesgo y no por facilidad: primero lo que puede
resultar imposible, después lo que solo es trabajo.

# Roadmap

## Estado actual

| Capa | Estado |
|---|---|
| Predicados, compromisos, Merkle, sesión, divulgación | Corre. 111 pruebas |
| Fuentes Colombia (PILA, listas), emisor | Corre, contra fuentes sintéticas |
| Anclaje agnóstico + adaptadores Stellar | Corre, contra submitters de prueba |
| Adaptador Chroma | Escrito; probado contra una colección de prueba |
| Circuitos Circom | Escritos, sin compilar |
| Contrato Soroban | Escrito, sin compilar ni desplegar |
| Integraciones reales | Ninguna |

## 1 — Cerrar el hueco de Poseidon sobre BLS12-381

**El único riesgo técnico que puede cambiar la arquitectura.** Todo lo demás
es trabajo conocido.

`circomlib` trae constantes de Poseidon para BN254. Para `-p bls12381` hacen
falta parámetros de ese campo. Compilar con el `bn128` por defecto produce
pruebas que **no** se verifican en Stellar hasta CAP-0074, y el modo de falla
es cruel: todo parece funcionar hasta la llamada al contrato.

En orden:

1. Generar parámetros de Poseidon para el campo escalar de BLS12-381 y
   compilar `merkle.circom` solo. Si esto sale, el resto sale.
2. Compilar `eligibility.circom`. Registrar el conteo de restricciones.
3. Setup de desarrollo (un contribuyente) y generar una prueba.
4. **Prueba diferencial**: correr el circuito y `core/src/predicates.ts`
   sobre las mismas entradas y exigir resultados idénticos. Hasta que exista,
   la corrección del circuito descansa en revisión.
5. Verificar on-chain. Medir el fee por simulación (`--send=no`).

**Contingencia, si (1) no sale a tiempo:** camino atestado — un verificador
off-chain corre la verificación y firma una atestación; el contrato hace
`require_auth` del atestador y aplica política. Hay que decir lo que es: **no
es ZK sin confianza**, es un oráculo de cómputo verificable, y el supuesto
(el atestador) va escrito en el README, no en una nota al pie.

## 2 — Unificar el hash

`core/` corre sobre sha256 con separación de dominio. El circuito necesita
Poseidon. Los dos lados de una prueba tienen que hashear idéntico.

Por eso existe `FieldHash` y por eso nadie llama a `node:crypto`
directamente: es un cambio de una implementación, no una cacería por el
código. Depende de (1).

## 3 — Compilar y desplegar el contrato

- `cargo build --target wasm32v1-none --release`, tests con `testutils`.
- Fijar la llave de verificación en el constructor.
- **Asegurar el orden de señales** de `signals_match` contra una fixture
  generada por el propio circuito. Equivocarse ahí no falla ruidosamente:
  autoriza la declaración equivocada.
- Desplegar en testnet, registrar una raíz de emisor, correr el recorrido.

## 4 — Fuentes reales, en orden de fricción

1. **Ingestor de listas restrictivas** (OFAC, ONU, Procuraduría,
   Contraloría). Públicas. Publicar el `listSetRoot` de cada instantánea.
2. **RUES**. Consulta pública. Habilita `capacity`.
3. **SNR / certificado de tradición**. Pago por consulta, sin convenio.
   Habilita `propertyStanding`.
4. **PILA vía operador**. Acuerdo comercial. Desbloquea el producto.
5. **Registraduría**. Convenio institucional.

## 5 — La interfaz

No hay UI todavía, y es deliberado: el sobre y la frontera de privacidad
tenían que estar primero, porque una UI construida sobre un modelo de datos
que filtra no se arregla con CSS.

Lo que la UI tiene que hacer bien, y que casi ninguna hace:

- **Mostrar la pregunta antes de la respuesta.** El sujeto lee qué se le
  pregunta y quién pregunta, y puede negarse por predicado.
- **Distinguir `unavailable` de `false`.** Son pantallas distintas: una dice
  "espera", la otra dice "no".
- **Hacer visible la revisión humana.** Un `ambiguous` en screening es una
  persona esperando, no un spinner.

## 6 — Lo que se decide después de la hackathon

- `propertyStanding` — el predicado sobre el inmueble. Probablemente el más
  valioso del catálogo, y le da la vuelta al producto: hoy el arrendatario
  prueba todo y el arrendador nada.
- Segunda jurisdicción. Perú primero: RENIEC tiene el mejor servicio de
  verificación de la región.
- Segunda cadena, para ejercitar el puerto contra algo que no sea Stellar.
