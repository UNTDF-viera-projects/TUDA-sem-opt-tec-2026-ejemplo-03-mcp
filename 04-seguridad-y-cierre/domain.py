"""Dominio local del laboratorio 04 (análogo al service layer Django de 03).

En el proyecto real este módulo NO existiría: el servidor MCP delegaría en
``activities.services.ActivityService`` de la etapa 03 (mismas excepciones y
misma semántica: transacción + constraint único). Aquí se replica esa
semántica en memoria para que la etapa 04 sea autocontenida y probables con
Inspector sin levantar Django. El mapeo es 1:1:

- ActivityNotFound  <-> actividad inexistente o ID no numérico (404 REST)
- InvalidEmail      <-> email inválido (400 REST)
- ActivityFull      <-> sin cupos (409 REST)
- AlreadyRegistered <-> constraint único (activity, student_email) (409 REST)

Reglas sensibles que NO se exponen vía MCP: la lista de emails inscriptos
nunca sale en resources/tools (sólo conteos/estado).
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field


class ActivityNotFound(Exception):
    """La actividad solicitada no existe."""


class ActivityFull(Exception):
    """La actividad ya no tiene cupos disponibles."""


class AlreadyRegistered(Exception):
    """El estudiante ya está inscripto en la actividad."""


class InvalidEmail(Exception):
    """El correo informado no es válido (chequeo de dominio, redundante)."""


@dataclass
class Activity:
    id: str
    title: str
    description: str
    available: bool
    seats: int      # cupos libres
    capacity: int   # cupo total


@dataclass
class _ActivityState:
    title: str
    description: str
    capacity: int
    is_active: bool
    registrations: set[str] = field(default_factory=set)


class ActivityService:
    """Caso de uso en memoria con la misma semántica que el Django."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # Seed análogo al de 03 (seed_activities): algunas con cupo, una llena.
        self._store: dict[str, _ActivityState] = {
            "1": _ActivityState(
                title="Taller de robótica",
                description="Introducción a Arduino.",
                capacity=20,
                is_active=True,
                registrations={f"alumno{i}@untdf.edu.ar" for i in range(8)},
            ),
            "2": _ActivityState(
                title="Club de lectura",
                description="Literatura patagónica.",
                capacity=15,
                is_active=True,
                registrations=set(),
            ),
            "3": _ActivityState(
                title="Fútbol 5",
                description="Torneo interno (cupo agotado).",
                capacity=10,
                is_active=True,
                registrations={f"jugador{i}@untdf.edu.ar" for i in range(10)},
            ),
        }

    # -- lecturas ---------------------------------------------------------
    def _to_dto(self, activity_id: str, state: _ActivityState) -> Activity:
        seats = state.capacity - len(state.registrations)
        available = state.is_active and seats > 0
        return Activity(
            id=activity_id,
            title=state.title,
            description=state.description,
            available=available,
            seats=max(seats, 0),
            capacity=state.capacity,
        )

    def list_available(self) -> list[Activity]:
        with self._lock:
            result = [
                self._to_dto(aid, st)
                for aid, st in sorted(
                    self._store.items(), key=lambda kv: kv[1].title
                )
            ]
        return [a for a in result if a.available]

    def get_activity(self, activity_id: str) -> Activity:
        with self._lock:
            state = self._store.get(str(activity_id))
            if state is None:
                raise ActivityNotFound(activity_id)
            return self._to_dto(str(activity_id), state)

    def search(self, query: str, only_available: bool = True) -> list[Activity]:
        text = str(query or "").strip().lower()
        with self._lock:
            items = [
                self._to_dto(aid, st)
                for aid, st in sorted(
                    self._store.items(), key=lambda kv: kv[1].title
                )
                if not text or text in st.title.lower()
            ]
        if only_available:
            items = [a for a in items if a.available]
        return items

    # -- escritura ---------------------------------------------------------
    def register(self, activity_id: str, student_email: str) -> dict[str, str]:
        """Inscribe. Idempotente en efecto: duplicado -> AlreadyRegistered."""
        email = str(student_email or "").strip().lower()
        with self._lock:
            state = self._store.get(str(activity_id))
            if state is None:
                raise ActivityNotFound(activity_id)
            if email in state.registrations:
                raise AlreadyRegistered(
                    f"{email} ya está inscripto en `{state.title}`."
                )
            if not state.is_active or len(state.registrations) >= state.capacity:
                raise ActivityFull(
                    f"La actividad `{state.title}` no tiene cupos."
                )
            state.registrations.add(email)
        return {
            "status": "registered",
            "activity_id": str(activity_id),
            "student_email": email,
        }

    def is_registered(self, activity_id: str, student_email: str) -> bool:
        with self._lock:
            state = self._store.get(str(activity_id))
            if state is None:
                return False
            return str(student_email).strip().lower() in state.registrations


_service: ActivityService | None = None
_service_lock = threading.Lock()


def get_activity_service() -> ActivityService:
    """Punto único de acceso (análogo a get_activity_service de Django).

    Si en el futuro se monta el Django real de la etapa 03, este es el único
    lugar a cambiar: devolver el ActivityService de activities.services.
    """
    global _service
    with _service_lock:
        if _service is None:
            _service = ActivityService()
        return _service
