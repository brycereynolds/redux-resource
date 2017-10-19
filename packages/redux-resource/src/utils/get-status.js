import requestStatuses from './request-statuses';
import warning from './warning';

function parts(str) {
  var i = 0;
  var parts = [];
  var d, b, q, c;
  while (i < str.length) {
    d = str.indexOf('.', i);
    b = str.indexOf('[', i);

    // we've reached the end
    if (d === -1 && b === -1) {
      parts.push(str.slice(i, str.length));
      i = str.length;
    }

    // dots
    else if (b === -1 || (d !== -1 && d < b)) {
      parts.push(str.slice(i, d));
      i = d + 1;
    }

    // brackets
    else {
      if (b > i) {
        parts.push(str.slice(i, b));
        i = b;
      }
      q = str.slice(b + 1, b + 2);
      if (q !== '"' && q !== '\'') {
        c = str.indexOf(']', b);
        if (c === -1) { c = str.length; }
        parts.push(str.slice(i + 1, c));
        i = (str.slice(c + 1, c + 2) === '.') ? c + 2 : c + 1;
      } else {
        c = str.indexOf(`${q}]`, b);
        if (c === -1) { c = str.length; }
        while (str.slice(c - 1, c) === '\\' && b < str.length) {
          b++;
          c = str.indexOf(`${q}]`, b);
        }
        parts.push(str.slice(i + 2, c).replace(new RegExp(`\\${q}`, 'g'), q));
        i = (str.slice(c + 2, c + 3) === '.') ? c + 3 : c + 2;
      }
    }
  }
  return parts;
}

function getSingleStatus(state, statusLocation, treatNullAsPending) {
  const splitPath = parts(statusLocation);

  let status;
  let currentVal = state;
  for (let i = 0; i < splitPath.length; i++) {
    const pathValue = currentVal[splitPath[i]];
    if (typeof pathValue === 'undefined') {
      status = requestStatuses.NULL;
      break;
    } else if (i === splitPath.length - 1) {
      status = pathValue;
    }

    currentVal = pathValue;
  }

  if (process.env.NODE_ENV !== 'production') {
    const isStatus = status === requestStatuses.NULL ||
      status === requestStatuses.PENDING ||
      status === requestStatuses.FAILED ||
      status === requestStatuses.SUCCEEDED;
    if (!isStatus) {
      warning(
        `You called "getStatus" with path "${statusLocation}", which resolved ` +
        `to a value that is not a valid resource status. You may want to ` +
        `check that this path is correct.`
      );
    }
  }

  const isPending = status === requestStatuses.PENDING;
  const isNull = status === requestStatuses.NULL;
  const treatNullAsPendingBool = Boolean(treatNullAsPending);

  return {
    null: isNull && !treatNullAsPendingBool,
    pending: isPending || (isNull && treatNullAsPendingBool),
    failed: status === requestStatuses.FAILED,
    succeeded: status === requestStatuses.SUCCEEDED,
  };
}

// Returns the status of a particular CRUD action based on `statusLocation`.
//
// `state`: A piece of the Redux store containing the relevant resources
// `action`: The CRUD action in question
// `statusLocation`: A location of the meta resource (see `find-meta.js` for more)
// `treatNullAsPending`: Whether or not to count a status of `NULL` as pending.
//
// Returns an Object with the following properties:
//
// {
//   null: false,
//   failed: false,
//   pending: false,
//   succeeded: true,
// }
//
// Note that at most _one_ of those properties will be true. It is
// possible for them to all be false.
export default function getStatus(state, statusLocations, treatNullAsPending) {
  if (!(statusLocations instanceof Array)) {
    return getSingleStatus(state, statusLocations, treatNullAsPending);
  }

  const statusValues = statusLocations.map(loc => getSingleStatus(state, loc, treatNullAsPending));

  let nullValue = true;
  let pending = false;
  let failed = false;
  let succeeded = false;

  let successCount = 0;
  let pendingCount = 0;
  for (let i = 0; i < statusValues.length; i++) {
    const status = statusValues[i];
    if (status.failed) {
      nullValue = false;
      failed = true;
      break;
    } else if (status.pending) {
      pendingCount++;
    } else if (status.succeeded) {
      successCount++;
    }
  }

  if (!failed && pendingCount > 0) {
    nullValue = false;
    pending = true;
  } else if (successCount === statusValues.length) {
    nullValue = false;
    succeeded = true;
  }

  return {null: nullValue, pending, failed, succeeded};
}
