-- =====================================================================
-- SkillUp · Base de datos · Franjas con el horario de Luthier.
-- BORRADOR del backend (Diego/Claude) para que Maxi lo revise y lo haga
-- suyo. Va DESPUÉS de 0004.
--
-- Horario de Luthier: lunes a jueves de 13:00 a 01:00; viernes y sábado
-- de 13:00 a 02:00. Domingo: igual que lunes a jueves [PENDIENTE CERVECERÍA].
--
-- Cambio: se saca 11_13 (antes de abrir) y se agrega 23_cierre, que
-- termina a la 01:00 o a las 02:00 según el día. Las demás no cambian.
--
-- Los datos son simulados: antes de aplicar esto, se borran los
-- servicios, turnos, solicitudes y eventos con 11_13, y después se carga
-- la semilla v3 (86 personas). Si queda alguna fila con 11_13, la
-- migración falla y no cambia nada.
-- =====================================================================

begin;

alter table public.servicio
    drop constraint servicio_franja_check,
    add constraint servicio_franja_check
        check (franja in ('13_15', '19_21', '21_23', '23_cierre'));

alter table public.solicitud_cambio
    drop constraint solicitud_cambio_franja_check,
    add constraint solicitud_cambio_franja_check
        check (franja in ('13_15', '19_21', '21_23', '23_cierre'));

alter table public.evento
    drop constraint evento_franjas_check,
    add constraint evento_franjas_check
        check (franjas <@ array['13_15', '19_21', '21_23', '23_cierre']);

commit;
