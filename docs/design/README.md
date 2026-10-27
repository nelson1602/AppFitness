# Rediseño AppFitnessRD

Este diseño es la referencia del rediseño de la app móvil: el código se adapta a él. Está hecho como página web (React + Tailwind) para revisarlo; en la app se implementa con React Native.

- `appfitnessrd-prototipo.html`: prototipo interactivo. Ábrelo en el navegador junto a las imágenes de esta carpeta.
- `muneco.webp`: arte original del muñeco con el logo (fondo azul). También en `mobile/assets/images/muneco.webp`.
- `muneco-solo.webp`: el muñeco recortado, sin fondo. También en `mobile/assets/images/muneco-solo.webp`.
- Prototipo publicado (cuenta de Claude): https://claude.ai/artifact/Vv5K9nEJhyz5ur2Bc9sveN

## Flujo

Login → (vincular biometría) → Evaluación física → el iCoach crea el plan → "Tu meta te espera" → Panel con pestañas.

## Reglas generales

- **El muñeco de la marca** se usa en todo lo relacionado con AppFitnessRD. No se inventan otras mascotas.
- **Textos:** "Entrenamientos", nunca "Entrenos". "Tu meta te espera" sustituye el concepto de racha.
- **Idiomas:** Español e English.
- **Estilo:** fondo azul marino oscuro con el resplandor azul del arte original, tarjetas de cristal translúcido, botones en degradado azul a celeste, acentos cian y naranja, pulso cardíaco animado. Tipografías: Sora (títulos) e Inter (texto).
- **Agua y ritmo cardíaco:** actualización futura con reloj inteligente. Hoy aparecen como "Próximamente".

## Pantallas

### Login (aprobado)
- El arte del muñeco se desvanece sin línea divisoria hacia el fondo oscuro, con el pulso animado debajo y "Cada latido cuenta."
- Formulario en tarjeta de cristal: correo, contraseña con botón de mostrar, "¿La olvidaste?", "Crea una cuenta".
- Texto de biometría: "Podrás activar Face ID o Huella al iniciar sesión."
- Después de entrar con contraseña se ofrece vincular Face ID o Huella según el hardware. Ya vinculada, aparece el botón para entrar con biometría.

### Evaluación física (6 pasos)
El usuario registra los resultados de su evaluación con el médico.
1. **Medidas:** peso, estatura, edad, sexo y fecha de la evaluación. IMC calculado al momento.
2. **Salud:**
   - Condiciones: Hipertensión, Diabetes, Asma, Condición cardíaca, Otros (abre un cuadro de texto).
   - Botón **Lesiones** que despliega: Hombro, Rodilla, Espalda baja, Muñeca, Codo, Tobillo, Cadera o pelvis, Cuello, Desgarre muscular, Periostitis tibial, Fascitis plantar, Otra lesión (abre un cuadro de texto).
   - Presión sistólica y diastólica, pulso en reposo, medicamentos.
3. **Alimentación:** grupos desplegables con los alimentos a excluir. Texto de ayuda: "Marca lo que no quieres en tu plan. El iCoach solo cambia lo que marques." Cada alimento marcado se indica como **Alergia** (no se puede registrar) o **Prefiero evitar** (solo avisa al registrarlo).
   - Frutas: guineo, manzana, fresas, arándanos, piña, lechosa, mango, naranja, sandía, kiwi, uvas, chinola.
   - Verduras y vegetales: brócoli, espinaca, lechuga, tomate, ajíes, zanahoria, pepino, coliflor, berenjena, cebolla, auyama.
   - Carnes, huevo y pescado: pollo, pavo, res, cerdo, pescado, atún, salmón, huevo.
   - Mariscos: camarones, langosta, cangrejo, pulpo, lambí, almejas y mejillones.
   - Lácteos: leche, yogur, queso, proteína whey, mantequilla.
   - Granos y cereales: trigo y pan, pasta, avena, cebada, centeno, arroz, quinoa, maíz.
   - Legumbres: habichuelas, lentejas, garbanzos, guandules, soya, maní.
   - Frutos secos y semillas: almendras, nueces, cajuil, pistachos, ajonjolí, chía, linaza.
   - Víveres: plátano, yuca, batata, papa, ñame, yautía.
   - Otras restricciones: alto en sodio, alto en purinas, azúcares añadidos, alcohol, cafeína, frituras.
4. **Estilo de vida:** nivel de actividad (5), estrés (5), horas de sueño, días para entrenar (2 a 6), equipo disponible.
5. **Meta:** tipo de meta (7), peso meta y fecha meta.
6. **Revisión:** resumen editable por sección y vista previa del iCoach (calorías, macros, ajustes por salud).

### iCoach
- Calcula calorías y macros (Mifflin-St Jeor × actividad ± ajuste por meta) y arma la semana de entrenamientos según los días disponibles.
- **Lesiones:** rodilla quita saltos y sentadilla profunda; espalda baja quita cargas pesadas sobre la espalda; hombro cambia el press militar por rotación externa con banda; tobillo, periostitis y fascitis cambian el trote por bicicleta; las demás bajan las cargas.
- **Otras reglas:** hipertensión o condición cardíaca → intensidad moderada; diabetes → carbohidratos repartidos; estrés alto → respiración al final; sueño corto → descansos más largos.
- **Días de entrenamiento:** el nivel limita los días (Principiante 3, Intermedio 5, Avanzado 6). Si las dos semanas anteriores se planificaron con los días actuales y en cada una se cumplió al menos el 80 % de los entrenamientos, el plan del lunes propone **un día más** con "¿Actualizar tu plan de esta semana?". Nunca pasa de los días que la persona eligió (ni de 6). Si elige más días de los que permite su nivel, Revisión lo explica (ADR-P040 D11).
- **Alimentos excluidos:** solo se quita el alimento marcado, nunca el plato completo ni el grupo. El iCoach lo cambia por otro del mismo tipo (proteína por proteína, víveres por víveres, fruta por fruta…) y si no hay sustituto lo quita. El plato muestra "Ajustado por iCoach: huevo → pechuga de pollo".
- **Otras restricciones** (sodio, purinas, azúcares, alcohol, cafeína, frituras) sí excluyen los productos que las tienen.
- **Comida fuera del plan:** recalcula. Si se pasó de calorías añade cardio al próximo entrenamiento y baja la meta del día siguiente; si fue alcohol, recomienda evitar el entrenamiento intenso.

### Panel (pestañas Inicio, Entrenamientos, Nutrición, Progreso, Perfil)
La pestaña activa muestra su nombre; las demás, solo el ícono.
- **Encabezado:** fecha, saludo y campanita con el número de notificaciones sin leer. Al tocarla se abre la lista; cada notificación lleva a su pantalla y hay "Marcar todo como leído".
- **Inicio:**
  - Tarjeta "Tu meta te espera" con anillo de entrenamientos de la semana (naranja; **verde al completar la semana**) y avance de peso hacia la meta.
  - iCoach: recomendación del día con los ajustes por salud. Botón "Empezar"; al terminar el de hoy, "Entrenamiento de hoy completado"; al completar la semana, **"Entrenamientos de esta semana completados"**.
  - Resumen de entrenamiento y calorías, evaluación del día (IMC, presión, macros), accesos rápidos y "Próximamente".
- **Entrenamientos:** semana del iCoach, series que se marcan una por una con descanso de 90 s, y al tocar un ejercicio se despliega la demostración del muñeco con 3 pasos de técnica.
- **Nutrición:**
  - Calorías y macros del día, plan de 15 días con barra deslizable y flechas (también fila de días con barra visible).
  - Cada plato muestra sus ingredientes sueltos con cantidad y calorías.
  - **Registrar comida:** botones de comida centrados; categorías Frecuentes, Todos, Bebidas, Dulces, Comida rápida, Frituras, Básicos, Platos y Mis alimentos con barra deslizable visible; búsqueda; porciones; favoritos con estrella; veces registrado; **"¿No lo encuentras? Crear alimento"** (nombre, porción, calorías) que se guarda en la base del usuario.
  - La base de alimentos debe crecer con tres fuentes: USDA FoodData Central (importación fijada según ADR-P013), una base de alimentos dominicanos (cada uno con su fuente documentada y nombre en español e inglés) y los alimentos creados por el usuario. Lo que más registra el usuario aparece primero. Open Food Facts no se usa.
- **Progreso:** gráfica de peso con línea de meta, registrar peso, medidas y resumen semanal.
  - **Semanas anteriores (plan vs. lo cumplido):** lista de las semanas pasadas, cada una con un anillo de cumplimiento (verde ≥ 85 %, cian ≥ 65 %, naranja menos), "X de Y entrenamientos · N % de las comidas". Al tocar una semana se abre el detalle:
    - **Entrenamientos:** cada sesión que el iCoach planificó (día y nombre) con "Cumplido" o "No realizado".
    - **Alimentación:** % de comidas del plan cumplidas, días dentro de la meta de calorías (de 7), promedio diario contra la meta.
    - **Peso:** cambio en la semana.
    - **iCoach:** una frase con lo que ajustó para la semana siguiente (mantener la carga si faltaron entrenamientos, subirla si se cumplió todo; recordar la meta de calorías si hubo pocos días dentro).
    - Cumplimiento = 50 % entrenamientos realizados / planificados + 50 % comidas del plan cumplidas.

### Plan semanal guardado
- El iCoach **guarda el plan de cada semana** (entrenamientos por día y plan de comidas) en el teléfono y lo sincroniza con la cuenta. Se muestra "Se renueva el lunes" en "Plan de la semana".
- El plan **no cambia a mitad de semana**. Se genera de nuevo el lunes con los datos de ese momento, o antes solo si el usuario cambia algo importante (meta, días para entrenar, equipo, lesiones o alimentos excluidos); en ese caso se le avisa y confirma.
- Registrar comidas, entrenamientos o peso no cambia el plan; solo actualiza el cumplimiento. La excepción es la comida fuera del plan, que puede ajustar el entrenamiento siguiente y la meta del día siguiente, como se describe en iCoach.
- Cada entrenamiento registrado queda ligado a la sesión del plan que cumple, para poder decir qué se cumplió.
- El historial (lo planificado y lo cumplido) se conserva para "Semanas anteriores" y se borra solo al eliminar la cuenta.
- **Perfil:** resumen de la evaluación con "Actualizar evaluación", meta, interruptor de Face ID o Huella, "Próximamente" y cerrar sesión.

## Animaciones del muñeco por ejercicio

Formato: video MP4 (o Lottie/GIF) cuadrado de 768 × 768, fondo negro liso (en la app se funde con "screen"), vista de lado, cuerpo completo, cámara fija, una repetición completa que empieza y termina en la misma postura, 3 a 6 s. Cada clip se revisa antes de conectarlo: si no muestra exactamente el movimiento, no se usa. Mientras no exista el clip, se muestra la figura dibujada.

Nombre del archivo = nombre del ejercicio (ej. `sentadilla-goblet.mp4`). ★ = los que la app usa hoy.

- **Piernas y glúteos:** ★Sentadilla goblet, Sentadilla con barra, Prensa de piernas, ★Zancadas, Sentadilla búlgara, ★Peso muerto rumano, ★Puente de glúteo, Hip thrust, Extensión de cuádriceps, Curl femoral, ★Abducción con banda, ★Elevación de talones, Subida al cajón.
- **Pecho:** ★Press de pecho con mancuernas, Press de banca con barra, Press inclinado, Aperturas con mancuernas, Flexiones, ★Flexiones inclinadas.
- **Espalda:** ★Remo con mancuerna, Remo con barra, Jalón al pecho en polea, ★Jalón con banda, Dominadas asistidas, Remo en polea baja.
- **Hombros:** ★Press militar sentado, Elevaciones laterales, Face pull, ★Rotación externa con banda.
- **Brazos:** Curl de bíceps, Curl martillo, Extensión de tríceps en polea, Fondos en banco.
- **Abdomen:** ★Plancha, ★Plancha lateral, ★Bird dog, ★Dead bug, Crunch abdominal, Elevación de piernas.
- **Cardio y recuperación:** ★Trote suave y caminata, ★Bicicleta estática, Elíptica, Saltar cuerda, Estiramiento de isquiotibiales, Respiración guiada.
