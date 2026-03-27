/**
 * useSocket — real-time WebSocket hook for NavBus
 *
 * Usage (passenger watching a bus):
 *   const { busUpdate, connected } = useSocket({ watchBusId: id })
 *
 * Usage (driver sending GPS):
 *   const { sendDriverLocation, connected } = useSocket({ driverBusId: busId })
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// Point at the deployed backend — injected from .env at build time
// Falls back to the same origin (works when Flask serves the frontend)
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;

let _socket = null;

function getSocket() {
  if (!_socket || _socket.disconnected) {
    _socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
    });
  }
  return _socket;
}

export function useSocket({ watchBusId = null, driverBusId = null } = {}) {
  const [connected, setConnected]   = useState(false);
  const [busUpdate,  setBusUpdate]  = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onUpdate     = (data) => setBusUpdate(data);

    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setConnected(true);

    // Passenger: join the room for one bus
    if (watchBusId) {
      socket.emit('watch_bus', { bus_id: watchBusId });
      socket.on('bus_update', onUpdate);
    }

    return () => {
      socket.off('connect',    onConnect);
      socket.off('disconnect', onDisconnect);
      if (watchBusId) {
        socket.off('bus_update', onUpdate);
        socket.emit('unwatch_bus', { bus_id: watchBusId });
      }
    };
  }, [watchBusId]);

  // Driver: send GPS via WebSocket (faster than REST)
  const sendDriverLocation = useCallback((lat, lng, speed) => {
    if (socketRef.current && driverBusId) {
      socketRef.current.emit('driver_location', {
        bus_id: driverBusId, lat, lng, speed,
      });
    }
  }, [driverBusId]);

  return { connected, busUpdate, sendDriverLocation, socket: socketRef.current };
}
