const TABLE_ASSIGNMENT_MESSAGE =
  'Please wait for service staff to assign your table before placing an order.';

const normalizeTableStatus = (
  status
) => {
  const normalized = String(
    status || 'available'
  )
    .trim()
    .toLowerCase();

  if (normalized === 'occupied') {
    return 'occupied';
  }

  return 'available';
};

const buildTableStatusPayload = ({
  tableNumber,
  restaurantTable,
  user,
  session,
}) => {
  const tableStatus =
    normalizeTableStatus(
      restaurantTable?.status
    );

  const tabletOnline =
    user?.is_online === true ||
    user?.is_online === 1 ||
    user?.is_online === 'true' ||
    user?.is_online === '1';

  const activeSessionId =
    session?.id ?? null;

  const canOrder =
    tableStatus === 'occupied' &&
    activeSessionId != null;

  return {
    table_number: String(
      tableNumber ??
        restaurantTable?.table_number ??
        user?.table_number ??
        ''
    ),
    table_status: tableStatus,
    tablet_online: tabletOnline,
    can_order: canOrder,
    active_session_id:
      activeSessionId,
  };
};

const fetchTableStatusForUser = async (
  supabase,
  user,
  getRestaurantTableByNumber,
  getActiveTableSession
) => {
  const {
    error: tableError,
    restaurantTable,
  } =
    await getRestaurantTableByNumber(
      user.table_number
    );

  if (
    tableError ||
    !restaurantTable
  ) {
    return {
      error:
        tableError ||
        new Error(
          `Table No. ${user.table_number} was not found.`
        ),
      payload: null,
    };
  }

  const {
    error: sessionError,
    session,
  } =
    await getActiveTableSession(
      restaurantTable.id
    );

  if (sessionError) {
    return {
      error: sessionError,
      payload: null,
    };
  }

  return {
    error: null,
    payload:
      buildTableStatusPayload({
        tableNumber:
          user.table_number,
        restaurantTable,
        user,
        session,
      }),
  };
};

module.exports = {
  TABLE_ASSIGNMENT_MESSAGE,
  normalizeTableStatus,
  buildTableStatusPayload,
  fetchTableStatusForUser,
};
