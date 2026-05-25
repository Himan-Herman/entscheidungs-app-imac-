export default {
  pageTitle: "Mis mediciones",
  pageHeading: "Mis mediciones",
  intro: "Tensión arterial, pulso, glucemia, peso y más — todo en un solo lugar.",
  disclaimer:
    "Resumen personal — no es un documento médico oficial. Muestre sus mediciones al médico en las consultas.",

  addEntry: "Añadir medición",
  noEntries: "Aún no hay mediciones registradas.",
  noEntriesHint: "Añada su primera medición para comenzar el seguimiento.",
  loadingError: "No se pudieron cargar las mediciones.",

  types: {
    blood_pressure: "Tensión arterial",
    heart_rate: "Pulso / Frecuencia cardiaca",
    glucose: "Glucemia",
    weight: "Peso",
    oxygen: "Saturación de oxígeno",
    temperature: "Temperatura corporal",
  },

  status: {
    normal: "Normal",
    elevated: "Elevado",
    low: "Bajo",
    unknown: "Sin referencia",
  },

  chart: {
    title: "Evolución",
    noData: "No hay suficientes datos para mostrar el gráfico.",
    systolic: "Sistólica",
    diastolic: "Diastólica",
    value: "Valor",
  },

  form: {
    addHeading: "Nueva medición",
    editHeading: "Editar medición",
    typeLabel: "Tipo de medición *",
    typePlaceholder: "Seleccione …",
    systolic: "Sistólica (mmHg) *",
    systolicPlaceholder: "p. ej. 120",
    diastolic: "Diastólica (mmHg) *",
    diastolicPlaceholder: "p. ej. 80",
    value: "Valor *",
    unit: "Unidad",
    measuredAt: "Fecha y hora *",
    notes: "Notas (opcional)",
    notesPlaceholder: "Circunstancias, cómo se sentía, información adicional …",
    save: "Guardar",
    saving: "Guardando …",
    cancel: "Cancelar",
    required: "* Campo obligatorio",
    fieldRequired: "Este campo es obligatorio.",
    dateInvalid: "Fecha no válida.",
    dateFuture: "La fecha no puede ser futura.",
    valueInvalid: "Introduzca un número válido.",
    valueOutOfRange: "El valor está fuera del rango plausible.",
    saveError: "Error al guardar. Inténtelo de nuevo.",
  },

  card: {
    measuredAt: "Medido el",
    notes: "Notas",
    edit: "Editar",
    editAria: "Editar medición",
    delete: "Eliminar",
    deleteAria: "Eliminar medición",
    source: "Fuente",
    manual: "Manual",
  },

  deleteDialog: {
    heading: "¿Eliminar la medición?",
    body: "Esta entrada se eliminará permanentemente. Esta acción no se puede deshacer.",
    confirm: "Sí, eliminar",
    cancel: "Cancelar",
    deleting: "Eliminando …",
    error: "Error al eliminar. Inténtelo de nuevo.",
  },

  tabs: {
    all: "Todas",
    blood_pressure: "Tensión",
    heart_rate: "Pulso",
    glucose: "Glucemia",
    weight: "Peso",
    oxygen: "SpO₂",
    temperature: "Temperatura",
  },

  refRanges: {
    blood_pressure: "Normal: < 120/80 mmHg",
    heart_rate: "Normal: 60–100 lpm",
    glucose: "Normal en ayunas: 70–100 mg/dL",
    weight: "Según la altura (IMC 18,5–24,9)",
    oxygen: "Normal: 95–100 %",
    temperature: "Normal: 36,1–37,2 °C",
  },
};
