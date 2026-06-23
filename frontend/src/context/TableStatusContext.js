import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getTableStatus } from '../api/dinesync';
import { useAuth } from './AuthContext';
import { TABLE_ASSIGNMENT_MESSAGE } from '../constants/tableStatus';

const TableStatusContext = createContext();

export const useTableStatus = () =>
  useContext(TableStatusContext);

const normalizeBoolean = (value) => {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === 'true'
  );
};

const normalizeTableStatus = (status) => {
  return String(status || '')
    .trim()
    .toLowerCase();
};

const isAssignedTableStatus = (status) => {
  const normalized =
    normalizeTableStatus(status);

  return [
    'seated',
    'occupied',
    'in_use',
    'active',
    'assigned',
  ].includes(normalized);
};

const isCleanOrAvailableStatus = (status) => {
  const normalized =
    normalizeTableStatus(status);

  return [
    'available',
    'clean',
    'vacant',
    'free',
  ].includes(normalized);
};

const normalizeStatusResponse = (response) => {
  if (!response) {
    return null;
  }

  const tableStatus =
    response.table_status ?? 'available';

  const activeSessionId =
    response.active_session_id ?? null;

  const backendCanOrder =
    normalizeBoolean(response.can_order);

  const hasActiveSession =
    activeSessionId !== null &&
    activeSessionId !== undefined &&
    String(activeSessionId).trim() !== '';

  const tableIsAssigned =
    isAssignedTableStatus(tableStatus);

  /**
   * STRICT ORDER RULE:
   * Customer/tablet can only order when service staff already assigned/seated the table.
   *
   * Backend must say can_order=true,
   * AND table must have an active session,
   * AND table status must be assigned/seated/occupied.
   */
  const strictCanOrder =
    backendCanOrder &&
    hasActiveSession &&
    tableIsAssigned;

  return {
    table_number:
      response.table_number ?? null,

    table_status:
      tableStatus,

    tablet_online:
      normalizeBoolean(response.tablet_online),

    can_order:
      strictCanOrder,

    backend_can_order:
      backendCanOrder,

    active_session_id:
      activeSessionId,

    has_active_session:
      hasActiveSession,

    table_is_assigned:
      tableIsAssigned,
  };
};

export const TableStatusProvider = ({
  children,
}) => {
  const { isLoggedIn } = useAuth();

  const [
    tableStatus,
    setTableStatus,
  ] = useState(null);

  const [
    statusLoading,
    setStatusLoading,
  ] = useState(false);

  const [
    tableResetRequired,
    setTableResetRequired,
  ] = useState(false);

  const pollRef = useRef(null);

  const previousSessionIdRef =
    useRef(null);

  const hasHadActiveSessionRef =
    useRef(false);

  const resetLocalStatus = useCallback(() => {
    setTableStatus(null);
    setTableResetRequired(false);

    previousSessionIdRef.current = null;
    hasHadActiveSessionRef.current = false;
  }, []);

  const detectCleanedTable = useCallback(
    (latestStatus) => {
      if (!latestStatus) {
        return;
      }

      const latestSessionId =
        latestStatus.active_session_id;

      const latestTableStatus =
        latestStatus.table_status;

      const previousSessionId =
        previousSessionIdRef.current;

      if (latestSessionId) {
        hasHadActiveSessionRef.current = true;

        previousSessionIdRef.current =
          latestSessionId;

        setTableResetRequired(false);

        return;
      }

      const sessionWasClosed =
        hasHadActiveSessionRef.current &&
        previousSessionId &&
        !latestSessionId;

      const tableWasCleaned =
        hasHadActiveSessionRef.current &&
        isCleanOrAvailableStatus(
          latestTableStatus
        );

      if (
        sessionWasClosed ||
        tableWasCleaned
      ) {
        setTableResetRequired(true);
      }

      previousSessionIdRef.current =
        latestSessionId;
    },
    []
  );

  const refreshTableStatus =
    useCallback(async () => {
      if (!isLoggedIn) {
        resetLocalStatus();
        return null;
      }

      try {
        setStatusLoading(true);

        const response =
          await getTableStatus();

        if (response?.success) {
          const normalized =
            normalizeStatusResponse(
              response
            );

          setTableStatus(normalized);

          detectCleanedTable(
            normalized
          );

          return normalized;
        }

        const fallbackStatus =
          normalizeStatusResponse(null);

        setTableStatus(fallbackStatus);

        return null;
      } catch (error) {
        console.log(
          'TABLE STATUS ERROR:',
          error?.response?.data ||
            error.message
        );

        return null;
      } finally {
        setStatusLoading(false);
      }
    }, [
      isLoggedIn,
      resetLocalStatus,
      detectCleanedTable,
    ]);

  useEffect(() => {
    if (!isLoggedIn) {
      resetLocalStatus();

      if (pollRef.current) {
        clearInterval(
          pollRef.current
        );

        pollRef.current = null;
      }

      return undefined;
    }

    refreshTableStatus();

    pollRef.current =
      setInterval(() => {
        refreshTableStatus();
      }, 5000);

    return () => {
      if (pollRef.current) {
        clearInterval(
          pollRef.current
        );

        pollRef.current = null;
      }
    };
  }, [
    isLoggedIn,
    refreshTableStatus,
    resetLocalStatus,
  ]);

  const canOrder =
    tableStatus?.can_order === true;

  const ensureCanOrder =
    useCallback(async () => {
      const latest =
        (await refreshTableStatus()) ||
        tableStatus;

      if (latest?.can_order === true) {
        return {
          allowed: true,
        };
      }

      return {
        allowed: false,
        message:
          TABLE_ASSIGNMENT_MESSAGE,
      };
    }, [
      refreshTableStatus,
      tableStatus,
    ]);

  const acknowledgeTableReset =
    useCallback(() => {
      /**
       * FIX:
       * Dati naka true ulit kaya hindi talaga naa-acknowledge.
       * Dapat false kapag na-handle na ng screen yung reset.
       */
      setTableResetRequired(false);

      previousSessionIdRef.current = null;
      hasHadActiveSessionRef.current = false;
    }, []);

  const value = useMemo(
    () => ({
      tableStatus,
      canOrder,
      statusLoading,
      tableResetRequired,
      refreshTableStatus,
      ensureCanOrder,
      acknowledgeTableReset,
      assignmentMessage:
        TABLE_ASSIGNMENT_MESSAGE,
    }),
    [
      tableStatus,
      canOrder,
      statusLoading,
      tableResetRequired,
      refreshTableStatus,
      ensureCanOrder,
      acknowledgeTableReset,
    ]
  );

  return (
    <TableStatusContext.Provider
      value={value}
    >
      {children}
    </TableStatusContext.Provider>
  );
};