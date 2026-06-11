# Aviso de privacidad — Plausibilidad de facturación GOÄ/PKV (piloto) — BORRADOR

> ⚠️ **BORRADOR DE TRADUCCIÓN — REVISIÓN LEGAL REQUERIDA ANTES DE LA PUBLICACIÓN.**
> Este es un **borrador** de traducción de la versión alemana de referencia; **no** es
> asesoramiento jurídico, **no** es vinculante y **no** es definitivo. La versión de
> referencia es la alemana
> ([`privacy-notice-billing-pilot.de.md`](privacy-notice-billing-pilot.de.md)). Se
> requiere una revisión independiente (DPO/jurista) antes de la publicación. Los
> marcadores `«entre corchetes angulares»` deben completarse previamente.
>
> Documentos relacionados: [borrador AVV/DPA](avv-dpa-medscoutx-pilot.de.md) ·
> [TOM](tom-medscoutx-pilot.de.md) ·
> [Subencargados](subprocessors-medscoutx-pilot.de.md)

---

## 1. Responsable / Encargado del tratamiento

- **Consultorio (Responsable):** `«nombre, dirección, contacto»` — responsable de los
  datos de facturación y de contexto introducidos durante el piloto.
- **MedScoutX (Encargado):** `«empresa operadora, dirección, contacto»` — trata los
  datos **por cuenta y siguiendo las instrucciones** del consultorio sobre la base de un
  acuerdo de tratamiento (AVV/DPA, ver [borrador](avv-dpa-medscoutx-pilot.de.md)).
- **Contacto de protección de datos:** `«correo / DPO si está designado»`
- La asignación final de roles se confirmará durante la revisión legal.

---

## 2. Finalidades

- Apoyo a la **plausibilidad de facturación** (GOÄ/PKV)
- Generación de **advertencias/indicaciones deterministas**
- Generación de un **informe PDF**
- Apoyo a la **exportación, supresión y conservación** (derechos de los interesados)
- **Registro, auditoría y seguridad internos**

---

## 3. Categorías de datos personales

- Identificadores de cuenta/personal (`createdByUserId`, `actorUserId`)
- Identificadores del perfil del consultorio (`practiceProfileId`)
- Código GOÄ, factor, cantidad
- **Texto de contexto libre** opcional (`contextText`)
- Metadatos de advertencia/resultado
- Metadatos de coincidencia del catálogo
- Metadatos del informe PDF
- Metadatos del registro de auditoría
- Registros técnicos
- **Metadatos de revisión IA** — solo si la IA está activada internamente (desactivada
  por defecto en externo, ver §5)

---

## 4. Datos que NO deben introducirse

No se deben introducir identificadores del paciente — en particular en el campo libre
`contextText`:

- Nombre del paciente
- Fecha de nacimiento
- Número de seguro
- Texto diagnóstico completo
- Texto clínico libre
- Otros identificadores directos del paciente

Los campos de paciente nombrados son rechazados por el sistema (HTTP 400). El campo
libre no puede impedir técnicamente la introducción de datos del paciente — el
consultorio lo garantiza mediante la **formación** del personal.

---

## 5. Estado de la IA

- La revisión asistida por IA está **desactivada por defecto** para consultorios
  externos (`ENABLE_BILLING_AI_REVIEW=false`).
- La IA se utiliza **solo internamente/staging** y solo con acuerdo separado.
- Una activación posterior requiere OpenAI como subencargado divulgado, una base
  jurídica documentada y una evaluación de transferencia (ver AVV §15).
- Las salidas de IA son **no vinculantes** y **no** constituyen una decisión médica,
  jurídica o de reembolso.

---

## 6. Bases jurídicas (marcadores)

- **Para el consultorio (responsable):** base jurídica `«a confirmar por el
  consultorio/jurista»` — probablemente ejecución del contrato (art. 6.1.b RGPD) o
  interés legítimo (art. 6.1.f RGPD).
- **Para MedScoutX (encargado):** tratamiento sobre la base del AVV/DPA y las
  instrucciones del consultorio.
- La base jurídica definitiva se determina solo tras la revisión legal; este borrador
  **no** hace ninguna declaración vinculante.

---

## 7. Destinatarios / Subencargados

- Proveedor de hosting/cómputo: `«a confirmar»`
- Proveedor de base de datos/hosting: `«a confirmar»`
- Proveedor de correo: `«a confirmar, si se utiliza»`
- **OpenAI:** solo si la IA está activada (desactivada por defecto en externo)
- Detalles: [anexo de subencargados](subprocessors-medscoutx-pilot.de.md). Los
  proveedores no confirmados se marcan como "a confirmar" y no se inventan.

---

## 8. Conservación y supresión

- **Período de conservación:** recomendación **180 días**
  (`BILLING_SESSION_RETENTION_DAYS=180`, orientativo) — a finalizar por el
  consultorio/DPO. **Ninguna** purga automática; la conservación se aplica mediante un
  script manual (D5).
- **Supresión de cuenta:** la supresión completa de la cuenta elimina los datos de
  facturación asociados en la misma transacción (D2).
- **Borrado por operador:** supresión dirigida por consultorio/usuario/sesión mediante
  un script de operador con dry-run y protección de producción (D4).
- **Exportación:** exportación JSON respetuosa con la privacidad de los propios datos de
  sesión (D3; `contextText` en bruto excluido).

---

## 9. Derechos de los interesados

Sujeto a las condiciones legales, usted tiene derecho a:

- Acceso (art. 15 RGPD)
- Rectificación (art. 16)
- Supresión (art. 17)
- Limitación (art. 18)
- Portabilidad (art. 20)
- Oposición cuando proceda (art. 21)
- Reclamación ante una autoridad de control (art. 77)

Contacto para el ejercicio: `«responsable / contacto de protección de datos»`.

---

## 10. Seguridad

- Control de acceso y acceso al consultorio basado en roles (solo propietario/admin)
- Cifrado en tránsito (TLS, a confirmar en el borde del proveedor)
- Registros de auditoría de los eventos del ciclo de vida de las sesiones
- Scripts de operador con dry-run por defecto y protección de producción
- **Ningún** conector PVS/FHIR/KIS en producción sin aprobación separada
- Detalles: [anexo TOM](tom-medscoutx-pilot.de.md)

---

## 11. Alcance y límites

- Apoyo a la plausibilidad **no vinculante**
- Utiliza un **subconjunto local del catálogo GOÄ** (no una fuente oficial completa)
- **Sin** diagnóstico
- **Sin** recomendación terapéutica
- **Sin** triaje
- **Sin** garantía/predicción de reembolso
- **Sin** decisión de facturación jurídicamente vinculante

---

*Estado: **BORRADOR DE TRADUCCIÓN — revisión legal requerida antes de la publicación.**
En caso de discrepancia prevalece la versión alemana de referencia.*
