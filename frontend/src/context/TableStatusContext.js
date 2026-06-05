import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { getTableStatus } from '../api/dinesync';
import { useAuth } from './AuthContext';
import { TABLE_ASSIGNMENT_MESSAGE } from '../constants/tableStatus';

const TableStatusContext =
  createContext();

export const useTableStatus = () =>
  useContext(TableStatusContext);

const normalizeStatusResponse = (
  response
) => {
  if (!response) {
    return null;
  }

  return {
    table_number:
      response.table_number ??
      null,
    table_status:
      response.table_status ??
      'available',
    tablet_online:
      response.tablet_online ===
        true ||
      response.tablet_online === 1,
    can_order:
      response.can_order === true ||
      response.can_order === 1,
    active_session_id:
      response.active_session_id ??
      null,
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

  const pollRef = useRef(null);

  const refreshTableStatus =
    useCallback(async () => {
      if (!isLoggedIn) {
        setTableStatus(null);
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

          setTableStatus(
            normalized
          );

          return normalized;
        }

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
    }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      setTableStatus(null);

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
      }, 10000);

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
  ]);

  const canOrder =
    tableStatus?.can_order === true;

  const ensureCanOrder = async () => {
    const latest =
      (await refreshTableStatus()) ||
      tableStatus;

    if (latest?.can_order) {
      return {
        allowed: true,
      };
    }

    return {
      allowed: false,
      message:
        TABLE_ASSIGNMENT_MESSAGE,
    };
  };

  return (
    <TableStatusContext.Provider
      value={{
        tableStatus,
        canOrder,
        statusLoading,
        refreshTableStatus,
        ensureCanOrder,
        assignmentMessage:
          TABLE_ASSIGNMENT_MESSAGE,
      }}
    >
      {children}
    </TableStatusContext.Provider>
  );
};
