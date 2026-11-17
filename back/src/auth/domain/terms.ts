/** Fuente única del documento presentado al registrar una cuenta. Conservar versiones en Git. */
export const terminosCondiciones = {
  version: "terminos-2026-11-17",
  secciones: [
    {
      titulo: "1. Propósito de la plataforma",
      parrafos: [
        "Professors’ Butchery es un espacio para compartir experiencias académicas sobre materias, docentes y cursadas. Su propósito es orientar a otros estudiantes a partir de las experiencias de sus pares.",
        "La información publicada puede ser subjetiva o quedar desactualizada. Consultá los canales oficiales de tu institución para confirmar programas, requisitos, fechas y otras decisiones académicas. La plataforma no sustituye esos canales ni se presenta como representante de las instituciones educativas.",
      ],
    },
    {
      titulo: "2. Cuenta e identidad",
      parrafos: [
        "Registrate con tu propio correo institucional de alumno y un nombre visible que no suplante a otra persona. El registro requiere verificar el correo antes de iniciar sesión. Cuidá tu contraseña y no compartas el acceso a tu cuenta.",
        "Usá la cuenta de manera responsable. No está permitido suplantar identidades, acceder a cuentas ajenas ni utilizar la plataforma para engañar a otros usuarios.",
      ],
    },
    {
      titulo: "3. Experiencias y participación académica",
      parrafos: [
        "Basá tus comentarios y valoraciones en experiencias propias y mantenelos relacionados con el ámbito académico. Procurá que sean claros, pertinentes y útiles para quienes deban elegir materias, docentes o cursadas.",
        "Podés expresar desacuerdos y críticas sobre tu experiencia, con respeto y sin presentar opiniones personales como hechos comprobados. Evitá acusaciones sin fundamento y contenido que exponga la vida privada de otras personas.",
      ],
    },
    {
      titulo: "4. Conductas y contenido no permitidos",
      parrafos: [
        "No se permiten insultos, amenazas, discriminación, acoso, hostigamiento, spam ni publicaciones ajenas al propósito académico de la plataforma.",
        "No publiques datos personales de terceros, como teléfonos, domicilios, documentos, contraseñas, información de salud o conversaciones privadas. Que un dato esté disponible en otro lugar no autoriza a divulgarlo en una publicación.",
      ],
    },
    {
      titulo: "5. Responsabilidad y opiniones personales",
      parrafos: [
        "Cada usuario es responsable del contenido que publica desde su cuenta y del respeto de estas condiciones. Antes de enviar un comentario o una respuesta, revisá su contenido y evitá incluir información que no corresponda compartir.",
        "Los comentarios y las valoraciones expresan opiniones personales de sus autores. No representan necesariamente a Professors’ Butchery, a su equipo, a los docentes ni a las instituciones educativas mencionadas.",
      ],
    },
    {
      titulo: "6. Moderación e incumplimientos",
      parrafos: [
        "El equipo de administración puede revisar el contenido y retirar comentarios que incumplan estas condiciones. También puede desactivar cuentas ante usos indebidos; una cuenta desactivada pierde acceso a las funciones autenticadas.",
        "La existencia de moderación no implica que todas las publicaciones se revisen antes de mostrarse. La baja de un comentario es lógica: puede conservarse información y su historial para la administración del sistema.",
      ],
    },
    {
      titulo: "7. Datos de cuenta y funcionamiento del servicio",
      parrafos: [
        "Para operar la cuenta, el sistema registra el correo electrónico, el nombre visible, una representación protegida de la contraseña, el rol y datos de creación, verificación y estado de la cuenta. También registra datos y credenciales de sesión, actividad y vencimiento para gestionar el acceso.",
        "La autenticación utiliza cookies de sesión. El correo electrónico se utiliza en los flujos de verificación de cuenta y recuperación de contraseña. Estos envíos utilizan el servicio de correo configurado para la plataforma.",
        "Al crear una cuenta se registra la versión de estos términos aceptada y la fecha de aceptación. Los comentarios, respuestas, valoraciones e interacciones quedan vinculados internamente a la cuenta y pueden tener fechas e historial de cambios.",
      ],
    },
    {
      titulo: "8. Visibilidad, anonimato y conservación",
      parrafos: [
        "El nombre visible puede acompañar tus publicaciones. Cuando elegís publicar de forma anónima, la interfaz oculta tu identidad a otros estudiantes, pero la publicación continúa vinculada internamente a tu cuenta. Esta opción no implica anonimato absoluto frente al sistema o a la administración autorizada.",
        "Las funciones administrativas permiten consultar y gestionar información de cuentas y contenido según los permisos del sistema. La edición o baja de contenido no supone que se eliminen todos los registros históricos. No publiques información sensible propia ni datos personales de terceros.",
      ],
    },
    {
      titulo: "9. Aceptación y versión del documento",
      parrafos: [
        "Para crear una cuenta debés aceptar expresamente la versión de los términos presentada en el formulario. Leer o cerrar este documento no marca la casilla ni registra una aceptación por sí solo.",
        "El documento está identificado por una versión. Si cambia mientras completás el registro, el sistema solicitará que consultes y aceptes la versión vigente antes de crear la cuenta.",
      ],
    },
  ],
} as const;

export const TERMS_ACCEPTANCE_REQUIRED = "Debés aceptar los términos y condiciones para crear tu cuenta";
export const TERMS_VERSION_CHANGED = "Los términos y condiciones cambiaron. Leelos nuevamente y aceptá la versión vigente.";
