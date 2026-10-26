# Lesiones → ejercicios (mapa del iCoach)

**Estado: PENDIENTE DE REVISIÓN PROFESIONAL.** Este mapa lo exige ADR-P040 D5, y ADR-P031 D4 pide que lo revise un profesional del ejercicio calificado. Mientras no esté firmado se aplica en su forma **más conservadora**: si hay duda, se excluye.

- Versión de la regla: `injury-map@1.0.0-pending-review` (código: `mobile/src/features/icoach/domain/injury-movement-map.ts`)
- Fecha: 2026-10-26
- Revisión profesional: _pendiente_ (nombre, credencial, fecha y cambios pedidos se anotan aquí)

## Cómo se aplica

1. En la evaluación (paso **Salud**) el usuario marca sus lesiones. Se guardan como valores cerrados en `wellness_safety_profiles.affected_areas`. No hay texto libre ("Otra lesión" queda fuera de v8).
2. El iCoach une los **movimientos excluidos** de cada lesión. Nunca deduce gravedad, diagnóstico ni permiso médico.
3. El generador de rutinas quita los ejercicios que usan esos movimientos y elige otro ejercicio del mismo papel con el equipo disponible. Las **sustituciones preferidas** de la tabla se usan primero si el equipo lo permite; si no hay un sustituto válido, el ejercicio se quita.
4. Cada exclusión deja un motivo traducible ("Ajustado por tu lesión de rodilla: sin saltos"). El usuario siempre ve qué cambió y por qué.
5. Los movimientos que el usuario declaró antes (formulario anterior) se siguen respetando: el resultado es la unión de ambos.

## Tabla

Los movimientos usan el vocabulario cerrado del motor (`WELLNESS_MOVEMENTS_TO_AVOID`).

| Lesión (ES / EN) | Valor guardado | Movimientos excluidos | Sustitución preferida | Nota del iCoach |
|---|---|---|---|---|
| Hombro / Shoulder | `shoulder` | `overhead_press`, `heavy_pressing`, `dips`, `front_rack_loading`, `max_effort_lifts` | Press militar → rotación externa con banda | Sin press por encima de la cabeza ni empujes pesados. |
| Rodilla / Knee | `knee` | `jumping`, `deep_squat`, `lunge`, `running`, `sprinting`, `high_impact_cardio` | Trote → bicicleta estática; sentadilla profunda → puente de glúteo | Sin saltos, sentadilla profunda ni impacto. |
| Espalda baja / Lower back | `lower_back` | `heavy_hinge`, `good_morning`, `loaded_spinal_flexion`, `loaded_carries`, `max_effort_lifts`, `valsalva_heavy_lifts`, `front_rack_loading` | Peso muerto → puente de glúteo | Sin cargas pesadas sobre la espalda. |
| Muñeca / Wrist | `wrist` | `heavy_pressing`, `front_rack_loading`, `dips`, `max_effort_lifts` | Flexiones → press con máquina si hay; si no, se quita | Cargas más bajas en empujes. |
| Codo / Elbow | `elbow` | `skull_crushers`, `dips`, `heavy_pressing`, `max_effort_lifts` | Rompecráneos → se quita | Cargas más bajas en brazos y empujes. |
| Tobillo / Ankle | `ankle` | `running`, `sprinting`, `jumping`, `high_impact_cardio`, `lunge` | Trote → bicicleta estática | Sin trote ni saltos. |
| Cadera o pelvis / Hip or pelvis | `hip` | `deep_squat`, `lunge`, `heavy_hinge`, `running`, `sprinting`, `jumping`, `high_impact_cardio` | Trote → bicicleta estática; sentadilla → abducción con banda | Sin sentadilla profunda, zancadas ni impacto. |
| Cuello / Neck | `neck` | `overhead_press`, `loaded_carries`, `front_rack_loading`, `max_effort_lifts`, `valsalva_heavy_lifts` | Press militar → rotación externa con banda | Sin cargas sobre hombros ni cuello. |
| Desgarre muscular / Muscle tear | `muscle_tear` | `max_effort_lifts`, `valsalva_heavy_lifts`, `sprinting`, `jumping`, `high_impact_cardio` | Intervalos → caminata | Cargas más bajas y sin esfuerzos máximos. |
| Periostitis tibial / Shin splints | `shin_splints` | `running`, `sprinting`, `jumping`, `high_impact_cardio` | Trote → bicicleta estática | Sin trote ni saltos. |
| Fascitis plantar / Plantar fasciitis | `plantar_fasciitis` | `running`, `sprinting`, `jumping`, `high_impact_cardio` | Trote → bicicleta estática | Sin trote ni saltos. |

"Cadera o pelvis" usa el valor existente `hip`. Los tres últimos valores son nuevos y llegan con una migración en SQLite y Postgres.

## Para el revisor

Marque cada fila como **Aprobada**, **Cambiar** (con el cambio) o **Quitar**. Si una fila resulta demasiado restrictiva, el cambio se publica como una nueva versión de la regla (`injury-map@1.1.0`) con sus pruebas, y nunca se edita en silencio.
