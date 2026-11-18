package dev.cube.jdbc;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Types;
import java.util.Base64;

/**
 * Reads rows of a ResultSet in batches and serializes every batch as a single JSON string,
 * so that the Node.js side pays for one JNI round trip per batch instead of one per cell.
 */
public final class RowBatcher {
  public static final int STRING = 0;
  public static final int INT = 1;
  public static final int DOUBLE = 2;
  public static final int BOOLEAN = 3;
  public static final int DATE = 4;
  public static final int TIME = 5;
  public static final int TIMESTAMP = 6;
  public static final int BYTES = 7;

  private static final char[] HEX = "0123456789abcdef".toCharArray();

  private RowBatcher() {
  }

  /**
   * Maps every column to the getter used to read it. Mirrors the type table of resultset.js.
   */
  public static int[] columnKinds(ResultSet rs) throws SQLException {
    ResultSetMetaData md = rs.getMetaData();
    int[] kinds = new int[md.getColumnCount()];

    for (int i = 0; i < kinds.length; i++) {
      switch (md.getColumnType(i + 1)) {
        case Types.TINYINT:
        case Types.SMALLINT:
        case Types.INTEGER:
          kinds[i] = INT;
          break;
        case Types.NUMERIC:
        case Types.DECIMAL:
          kinds[i] = STRING;
          break;
        case Types.FLOAT:
        case Types.REAL:
        case Types.DOUBLE:
          kinds[i] = DOUBLE;
          break;
        case Types.BIT:
        case Types.BOOLEAN:
          kinds[i] = BOOLEAN;
          break;
        case Types.DATE:
          kinds[i] = DATE;
          break;
        case Types.TIME:
          kinds[i] = TIME;
          break;
        case Types.TIMESTAMP:
          kinds[i] = TIMESTAMP;
          break;
        case Types.BINARY:
        case Types.VARBINARY:
        case Types.LONGVARBINARY:
        case Types.BLOB:
          kinds[i] = BYTES;
          break;
        default:
          kinds[i] = STRING;
      }
    }

    return kinds;
  }

  /**
   * Returns up to maxRows rows as a JSON array of row arrays, or null when the ResultSet is
   * exhausted. A batch is also cut once it grows past maxChars, which bounds the size of a
   * single string for wide rows.
   *
   * Non-finite doubles have no JSON number form and are written as the strings "NaN",
   * "Infinity" and "-Infinity".
   */
  public static String fetch(ResultSet rs, int[] kinds, int maxRows, int maxChars) throws SQLException {
    StringBuilder sb = new StringBuilder(8192);
    sb.append('[');

    int rows = 0;
    while (rows < maxRows && (rows == 0 || sb.length() < maxChars) && rs.next()) {
      if (rows++ > 0) {
        sb.append(',');
      }

      sb.append('[');
      for (int i = 0; i < kinds.length; i++) {
        if (i > 0) {
          sb.append(',');
        }
        appendCell(sb, rs, i + 1, kinds[i]);
      }
      sb.append(']');
    }

    if (rows == 0) {
      return null;
    }

    return sb.append(']').toString();
  }

  private static void appendCell(StringBuilder sb, ResultSet rs, int column, int kind) throws SQLException {
    switch (kind) {
      case INT: {
        int value = rs.getInt(column);
        if (rs.wasNull()) {
          sb.append("null");
        } else {
          sb.append(value);
        }
        break;
      }
      case DOUBLE: {
        double value = rs.getDouble(column);
        if (rs.wasNull()) {
          sb.append("null");
        } else if (Double.isNaN(value) || Double.isInfinite(value)) {
          sb.append('"').append(value).append('"');
        } else {
          sb.append(value);
        }
        break;
      }
      case BOOLEAN: {
        boolean value = rs.getBoolean(column);
        if (rs.wasNull()) {
          sb.append("null");
        } else {
          sb.append(value);
        }
        break;
      }
      case DATE:
        appendObject(sb, rs.getDate(column));
        break;
      case TIME:
        appendObject(sb, rs.getTime(column));
        break;
      case TIMESTAMP:
        appendObject(sb, rs.getTimestamp(column));
        break;
      case BYTES: {
        byte[] value = rs.getBytes(column);
        if (value == null) {
          sb.append("null");
        } else {
          sb.append('"').append(Base64.getEncoder().encodeToString(value)).append('"');
        }
        break;
      }
      default:
        appendString(sb, rs.getString(column));
    }
  }

  private static void appendObject(StringBuilder sb, Object value) {
    appendString(sb, value == null ? null : value.toString());
  }

  private static void appendString(StringBuilder sb, String value) {
    if (value == null) {
      sb.append("null");
      return;
    }

    sb.append('"');
    int start = 0;
    int length = value.length();
    for (int i = 0; i < length; i++) {
      char c = value.charAt(i);
      if (c >= 0x20 && c != '"' && c != '\\') {
        continue;
      }

      sb.append(value, start, i);
      start = i + 1;

      if (c == '"' || c == '\\') {
        sb.append('\\').append(c);
      } else {
        sb.append("\\u00").append(HEX[c >> 4]).append(HEX[c & 0xf]);
      }
    }
    sb.append(value, start, length).append('"');
  }
}
