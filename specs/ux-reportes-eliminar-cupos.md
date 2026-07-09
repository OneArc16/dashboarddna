# Spec UX: Reportes y Eliminar Cupos

## Contexto

Las pantallas `Reportes` y `Eliminar cupos` ya fueron mejoradas visualmente, pero todavia existen fricciones de uso que afectan comodidad, lectura y continuidad de tarea.

Este spec define mejoras de UX que no deben alterar la logica de negocio ni los contratos actuales de API. El objetivo es hacer el flujo mas claro, mas comodo y mas predecible para el usuario final.

## Objetivo

Mejorar la experiencia de uso en:

- `src/pages/reportes.tsx`
- `src/pages/eliminar-cupos.tsx`
- componentes compartidos de agenda y filtros

sin modificar:

- reglas de consulta
- reglas de eliminacion
- estructura funcional de datos
- permisos o criterios de negocio

## Principios

- UX funcional sobre decoracion visual.
- Menos friccion para buscar, revisar y actuar.
- Estados visibles y comprensibles sin depender de toasts.
- Acciones criticas claras y seguras.
- Componentes reutilizables y codigo mantenible.

## Problemas Detectados

### 1. Los filtros no sobreviven al cambio de contexto

Actualmente los filtros viven solo en estado local. Si el usuario recarga, comparte la URL o vuelve atras, pierde la configuracion de trabajo.

### 2. La tabla exige demasiado scroll horizontal

Las tablas siguen siendo densas y dependen de `overflow-x-auto`. En pantallas estrechas esto obliga a desplazar demasiado para entender una fila.

### 3. La validacion no aterriza en el campo exacto

Los errores de rango y hora se comunican de forma general, pero no guian al usuario directamente al punto que debe corregir.

### 4. El feedback de carga y exportacion depende demasiado del toast

El usuario recibe confirmacion por toast, pero la interfaz no siempre mantiene contexto suficiente dentro de la propia pantalla.

### 5. La seleccion masiva en eliminar cupos puede perder visibilidad

Cuando hay muchas filas, las acciones de seleccion y eliminacion quedan lejos del foco de lectura y requieren esfuerzo extra.

### 6. Hay diferencias de lenguaje entre estados y etiquetas

El sistema mezcla etiquetas como `Inasistentes`, `Asignada`, `Activadas` y `Sin asignar` segun el lugar de la UI, lo que genera una pequena carga cognitiva.

### 7. Los multiselect mejoraron, pero todavia pueden orientar mejor

En listas largas o dependientes de otros filtros, el usuario no siempre entiende rapido por que una opcion no aparece o cuantos elementos tiene disponibles.

### 8. La lectura de resultados truncados depende de hover

Hoy varios campos largos se leen completos con `title`, lo cual no resuelve bien el uso movil o tactil.

## Alcance

### Incluye

- persistencia de filtros en la URL
- mejoras responsive de tabla
- detalle expandible por fila en contextos estrechos
- validacion inline y accesible
- mejoras de feedback de carga, exportacion y seleccion
- unificacion de copys de estado
- mejoras de usabilidad en multiselect
- reduccion de dependencia de toasts informativos

### No incluye

- cambios de modelo de datos
- nuevas reglas de negocio
- cambios en SQL o Prisma por razones funcionales
- nuevas capacidades de exportacion
- cambios de permisos

## Usuarios Impactados

- personal administrativo que consulta reportes
- usuarios que limpian cupos libres por rango
- usuarios que trabajan con volumen alto de filas
- usuarios en pantallas pequenas o portatiles

## Propuesta

## Mejora 1: Persistencia de filtros en URL

### Objetivo

Permitir que el estado de filtros sobreviva a recarga, retroceso del navegador y comparticion del enlace.

### Comportamiento esperado

- Al cambiar filtros relevantes, la URL refleja el estado actual.
- Al abrir la pagina con query params validos, la UI se hidrata con esos valores.
- `Buscar` y `Exportar` usan exactamente el mismo estado visible.
- `Restablecer filtros` limpia tambien la URL.

### Campos a persistir

- `desde`
- `hasta`
- `horaDesde`
- `horaHasta`
- `eps`
- `especialidades`
- `medicos`
- `estados`
- `limit`

### Criterios de aceptacion

- Recargar la pagina conserva los filtros.
- Compartir la URL abre la misma configuracion visible.
- No se dispara una consulta automatica no deseada si el producto no la requiere.
- La serializacion y deserializacion vive en helpers o hooks reutilizables.

## Mejora 2: Tabla mas util en pantallas estrechas

### Objetivo

Reducir la friccion de lectura sin cambiar la estructura base de resultados.

### Comportamiento esperado

- En desktop se mantiene la tabla.
- En tablet y movil se priorizan columnas clave.
- La informacion secundaria de la fila se puede ver sin depender de hover.

### Propuesta de interaccion

- Mantener visibles como prioridad:
  - seleccion, si aplica
  - fecha
  - hora
  - paciente
  - telefono
  - estado
- Mover el resto a un detalle expandible por fila en viewport estrecho:
  - EPS
  - medico
  - tipo cita
  - documento
  - id cita

### Criterios de aceptacion

- El usuario puede entender una fila sin scroll horizontal excesivo.
- El detalle expandible funciona con teclado y tactil.
- No se pierde informacion respecto a la tabla actual.
- El patron reutilizable sirve para ambas pantallas.

## Mejora 3: Validacion inline y enfoque al primer error

### Objetivo

Guiar al usuario a corregir mas rapido y con menos ensayo y error.

### Comportamiento esperado

- Los campos invalidos marcan error visual de forma localizada.
- Cada error aparece cerca del campo correspondiente.
- Al intentar buscar con errores, el foco va al primer campo invalido.
- Se usan atributos accesibles como `aria-invalid` y `aria-describedby`.

### Casos minimos

- `desde` vacio
- `hasta` vacio
- `desde > hasta`
- `horaDesde > horaHasta`

### Criterios de aceptacion

- El usuario identifica de inmediato que campo corregir.
- El lector de pantalla recibe el error.
- La validacion no genera parpadeos ni mensajes duplicados.

## Mejora 4: Feedback persistente de carga y exportacion

### Objetivo

Hacer que la pantalla explique mejor lo que esta ocurriendo sin depender de mensajes efimeros.

### Comportamiento esperado

- Durante `Buscar`, la tabla conserva contexto previo o muestra skeleton claro.
- Durante `Exportar`, el boton refleja estado de proceso.
- Los mensajes de exito resumidos viven preferiblemente cerca del bloque de resultados.
- Los toasts se reservan para errores, confirmaciones o acciones puntuales.

### Criterios de aceptacion

- El usuario sabe si la consulta esta corriendo.
- No hay sensacion de pantalla congelada.
- El usuario no necesita releer un toast para entender el estado actual.

## Mejora 5: Barra de acciones sticky para seleccion

### Objetivo

Mantener accesibles las acciones de seleccion y borrado cuando la lista es larga.

### Comportamiento esperado

- En `Eliminar cupos`, cuando existen filas o seleccion activa, aparece una barra sticky de acciones.
- La barra muestra:
  - cantidad seleccionada
  - cantidad de cupos libres disponibles
  - accion para seleccionar libres
  - accion para limpiar seleccion
  - accion destructiva para eliminar

### Criterios de aceptacion

- Las acciones no desaparecen al hacer scroll largo.
- La accion destructiva sigue siendo claramente secundaria frente al contexto de confirmacion.
- La barra no tapa contenido critico ni rompe mobile.

## Mejora 6: Unificacion de lenguaje de estados

### Objetivo

Evitar inconsistencias semanticas entre resumenes, filtros, badges y mensajes.

### Propuesta

Definir una sola capa de etiquetas reutilizable para:

- label corto
- label descriptivo
- color y badge
- texto de ayuda

### Reglas

- El mismo estado no debe cambiar de nombre segun la zona de la UI.
- Si un termino tecnico debe mantenerse por negocio, se acompana con texto mas claro en la interfaz.

### Criterios de aceptacion

- Los estados se leen igual en tarjetas, filtros, tabla y mensajes.
- No existen copys duplicados hardcodeados en varias pantallas.

## Mejora 7: Multiselect con mejor orientacion

### Objetivo

Reducir confusion en filtros dependientes y listas largas.

### Comportamiento esperado

- El componente informa mejor cuando no hay opciones por seleccion actual.
- El resumen inferior explica cantidad y disponibilidad.
- El menu deja claro que se puede escribir para filtrar.
- Si el volumen crece, se deja preparado para virtualizacion sin reescribir el componente.

### Criterios de aceptacion

- El usuario entiende por que un medico no aparece tras filtrar especialidad.
- El componente sigue siendo reutilizable.
- No se introduce logica duplicada en cada pagina.

## Mejora 8: Lectura completa sin hover

### Objetivo

Permitir revisar valores truncados tambien en tactil y accesibilidad.

### Propuesta

- Evitar depender solo de `title`.
- Ofrecer una de estas opciones reutilizables:
  - detalle expandible por fila
  - drawer liviano de detalle
  - celda con expandir/contraer

### Criterios de aceptacion

- Un usuario movil puede leer nombres largos completos.
- La solucion no agrega ruido visual permanente.

## Requisitos Tecnicos

- No cambiar contratos actuales de API salvo que sea necesario para texto auxiliar no funcional.
- Reutilizar componentes compartidos para evitar duplicacion entre `Reportes` y `Eliminar cupos`.
- Extraer helpers y hooks para:
  - sincronizacion URL <-> filtros
  - validacion de formulario
  - configuracion de columnas visibles
  - copys de estado
- Evitar condicionales complejos dentro de JSX cuando puedan vivir en helpers.
- Mantener tipado estricto en TypeScript.
- No introducir dependencias nuevas si el problema se resuelve con primitives actuales.

## Propuesta de Estructura Tecnica

- `src/lib/agenda-ui.ts`
  - centralizar metadatos de estado y textos consistentes
- `src/hooks/useAgendaFilters.ts`
  - serializacion, lectura y reset de query params
- `src/hooks/useAgendaValidation.ts`
  - validaciones de rango y foco al error
- `src/components/agenda/ResponsiveResultsTable.tsx`
  - tabla compartida con soporte de detalle expandible
- `src/components/agenda/SelectionActionBar.tsx`
  - barra sticky para seleccion masiva

Los nombres son orientativos. Se puede ajustar si el repo ya define otro patron mejor.

## Prioridades

### Fase 1

- persistencia de filtros en URL
- validacion inline accesible
- unificacion de lenguaje de estados

### Fase 2

- tabla responsive con detalle expandible
- lectura completa sin hover
- feedback persistente de carga y exportacion

### Fase 3

- barra sticky de acciones
- mejoras avanzadas de multiselect

## Riesgos

- Persistir demasiados filtros en URL puede volverla larga.
- Cambiar el patron de tabla requiere cuidado para no afectar seleccion y accesibilidad.
- Si se mezcla validacion visual con mensajes globales sin criterio, la UI puede duplicar feedback.

## Mitigaciones

- Mantener naming corto en query params cuando aplique.
- Crear componentes compartidos antes de modificar ambas paginas en paralelo.
- Probar teclado, tactil y desktop en cada cambio.
- Mantener los toasts solo como capa secundaria de feedback.

## Definicion de Hecho

- Las dos pantallas comparten patrones de filtro, feedback y lectura.
- Los usuarios pueden retomar una busqueda sin reconfigurar todo manualmente.
- La tabla se puede usar mejor en pantallas estrechas.
- Los errores orientan sin ambiguedad.
- El codigo resultante queda modular, tipado y sin duplicacion innecesaria.

## Referencias de Implementacion Actual

- `src/pages/reportes.tsx`
- `src/pages/eliminar-cupos.tsx`
- `src/components/MultiSelectRS.tsx`
- `src/components/agenda/StatsOverview.tsx`
- `src/components/agenda/StatusBadge.tsx`
- `src/components/agenda/StatusMessage.tsx`
- `src/lib/agenda-ui.ts`
