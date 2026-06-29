import asyncio
import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)


class NodeManager:
    """
    Owns the single shared asyncio event loop running in a background thread.
    All meshcore connections live inside this loop.
    Flask routes interact via run_async() which bridges sync → async.
    """

    def __init__(self) -> None:
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._connections: dict[int, object] = {}  # node_id → NodeConnection
        self._app = None
        self._pending_pings: dict[tuple, dict] = {}  # (node_id, contact_id) → waiter

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self, app) -> None:
        self._app = app
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(
            target=self._run_loop,
            daemon=True,
            name='meshwarden-asyncio',
        )
        self._thread.start()
        logger.info('NodeManager: asyncio event loop started')
        # Connect all enabled nodes from DB
        self.run_async(self._reconnect_enabled())

    def _run_loop(self) -> None:
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    # ------------------------------------------------------------------
    # Sync ↔ Async bridge
    # ------------------------------------------------------------------

    def run_async(self, coro, timeout: float = 30):
        """Block the calling thread until coro completes in the asyncio loop."""
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result(timeout=timeout)

    # ------------------------------------------------------------------
    # Connection management (internal async)
    # ------------------------------------------------------------------

    async def _reconnect_enabled(self) -> None:
        with self._app.app_context():
            from ..extensions import db
            from ..db.models import Node
            nodes = db.session.execute(
                db.select(Node).filter_by(enabled=True)
            ).scalars().all()
            for node in nodes:
                await self._connect(node.id)

    async def _connect(self, node_id: int) -> None:
        from ..db.models import Node
        from ..extensions import db
        from .connection import NodeConnection

        with self._app.app_context():
            node = db.session.get(Node, node_id)
            if not node:
                logger.warning(f'Node {node_id} not found in DB')
                return

        if node_id in self._connections:
            await self._connections[node_id].disconnect()

        conn = NodeConnection(node_id, node, self._app)
        self._connections[node_id] = conn
        await conn.connect()

    async def _disconnect(self, node_id: int) -> None:
        conn = self._connections.pop(node_id, None)
        if conn:
            await conn.disconnect()

    # ------------------------------------------------------------------
    # Public API (callable from Flask routes — synchronous)
    # ------------------------------------------------------------------

    def connect(self, node_id: int) -> None:
        logger.info(f'NodeManager: connecting node {node_id}')
        self.run_async(self._connect(node_id))

    def disconnect(self, node_id: int) -> None:
        logger.info(f'NodeManager: disconnecting node {node_id}')
        self.run_async(self._disconnect(node_id))

    def is_connected(self, node_id: int) -> bool:
        conn = self._connections.get(node_id)
        return conn is not None and conn.is_connected

    def get_connection(self, node_id: int):
        return self._connections.get(node_id)

    def connection_statuses(self) -> dict[int, bool]:
        return {nid: c.is_connected for nid, c in self._connections.items()}

    def call(self, node_id: int, coro, timeout: float = 30):
        """Run an arbitrary meshcore coroutine for a given node."""
        return self.run_async(coro, timeout=timeout)

    def sync(self, node_id: int) -> None:
        """Re-sync contacts and info from the node."""
        conn = self._connections.get(node_id)
        if conn and conn.is_connected:
            self.run_async(conn.sync())

    def set_pending_ping(self, node_id: int, contact_id: int, waiter: dict) -> None:
        self._pending_pings[(node_id, contact_id)] = waiter

    def get_pending_ping(self, node_id: int, contact_id: int):
        return self._pending_pings.get((node_id, contact_id))

    def clear_pending_ping(self, node_id: int, contact_id: int) -> None:
        self._pending_pings.pop((node_id, contact_id), None)


node_manager = NodeManager()
