package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.payload.parser.enumration.SqlDialect;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CsvToSqlParseServiceImpl implements ParserService {
    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Response parse(Request request) {
        Map<String, Object> filters = request.getFilters();
        String tableName = filters.getOrDefault("tableName", "data").toString();
        String dialect = filters.getOrDefault("dialect", "MySQL").toString();
        boolean includeNulls = (boolean) filters.getOrDefault("includeNulls", true);
        String result = convert(request.getData(), tableName, SqlDialect.fromString(dialect), includeNulls);
        return new Response(true, "success", result, HttpStatus.OK.toString());
    }

    @Override
    public String getType() {
        return "CSV_TO_SQL";
    }

    public static String convert(String csvData, String tableName, SqlDialect dialect, boolean includeNulls) {
        List<JsonNode> rows;
        try {
            rows = parseCsvToRows(csvData);
        } catch (Exception e) {
            throw new RuntimeException("Invalid CSV input", e);
        }

        if (rows.isEmpty()) return "";

        // Reuse EXACT JSON convert logic from JsonToSqlParseServiceImpl
        Map<String, String> schema = inferSchema(rows.get(0), dialect);
        StringBuilder sql = new StringBuilder();

        /* ---------- CREATE TABLE ---------- */
        sql.append("CREATE TABLE ")
                .append(quote(tableName, dialect))
                .append(" (\n");

        int i = 0;
        for (var e : schema.entrySet()) {
            sql.append("  ")
                    .append(quote(e.getKey(), dialect))
                    .append(" ")
                    .append(e.getValue());

            if (++i < schema.size()) sql.append(",");
            sql.append("\n");
        }
        sql.append(");\n\n");

        /* ---------- INSERT ---------- */
        List<String> insertColumns = new ArrayList<>(schema.keySet());

        if (!includeNulls) {
            insertColumns.removeIf(col ->
                    rows.stream().allMatch(r -> r.get(col) == null || r.get(col).isNull())
            );
        }

        sql.append("INSERT INTO ")
                .append(quote(tableName, dialect))
                .append(" (");

        sql.append(insertColumns.stream()
                .map(c -> quote(c, dialect))
                .collect(Collectors.joining(", ")));

        sql.append(") VALUES\n");

        for (int r = 0; r < rows.size(); r++) {
            JsonNode row = rows.get(r);
            sql.append("(");

            int c = 0;
            for (String col : insertColumns) {
                JsonNode value = row.get(col);

                if (value == null || value.isNull()) {
                    sql.append(includeNulls ? "NULL" : "DEFAULT");
                } else {
                    sql.append(formatValue(value, dialect, mapper));
                }

                if (++c < insertColumns.size()) sql.append(", ");
            }

            sql.append(")");
            if (r < rows.size() - 1) sql.append(",");
            sql.append("\n");
        }

        sql.append(";");

        return sql.toString();
    }

    /* ---------- CSV Parsing to JsonNode Rows ---------- */
    private static List<JsonNode> parseCsvToRows(String csvData) throws IOException {
        try (CSVParser parser = CSVFormat.DEFAULT
                .withFirstRecordAsHeader()
                .withSkipHeaderRecord(true)
                .parse(new StringReader(csvData))) {

            List<JsonNode> rows = new ArrayList<>();
            for (CSVRecord record : parser) {
                ObjectNode rowNode = mapper.createObjectNode();
                parser.getHeaderMap().forEach((header, index) -> {
                    String value = record.isMapped(header) ? record.get(header) : null;
                    rowNode.put(header, value);
                });
                rows.add(rowNode);
            }
            return rows;
        }
    }

    /* ---------- Reuse ALL helpers from JsonToSqlParseServiceImpl ---------- */
    // inferSchema, sqlType, varchar, formatValue, quote (copy exactly)
    private static Map<String, String> inferSchema(JsonNode node, SqlDialect dialect) {
        Map<String, String> schema = new LinkedHashMap<>();
        node.fieldNames().forEachRemaining(f ->
                schema.put(f, sqlType(node.get(f), dialect))
        );
        return schema;
    }

    private static String sqlType(JsonNode node, SqlDialect dialect) {
        if (node == null || node.isNull()) return varchar(dialect);

        if (node.isObject() || node.isArray()) {
            return switch (dialect) {
                case MYSQL -> "JSON";
                case POSTGRES -> "JSONB";
                case SQLSERVER -> "NVARCHAR(MAX)";
                case SQLITE -> "TEXT";
                default -> "VARCHAR(4000)";
            };
        }

        if (node.isInt() || node.isLong()) return "INT";
        if (node.isFloat() || node.isDouble() || node.isBigDecimal()) return "DECIMAL";
        if (node.isBoolean())
            return dialect == SqlDialect.SQLSERVER ? "BIT" : "BOOLEAN";

        return varchar(dialect);
    }



    private static String varchar(SqlDialect dialect) {
        return switch (dialect) {
            case SQLSERVER -> "NVARCHAR(255)";
            case SQLITE -> "TEXT";
            default -> "VARCHAR(255)";
        };
    }

    /* ---------- Value formatting ---------- */

    private static String formatValue(JsonNode node, SqlDialect dialect, ObjectMapper mapper) {
        if (node.isObject() || node.isArray()) {
            try {
                String json = mapper.writeValueAsString(node);
                return "'" + json.replace("'", "''") + "'";
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        if (node.isBoolean()) {
            return dialect == SqlDialect.SQLSERVER
                    ? (node.asBoolean() ? "1" : "0")
                    : node.asText();
        }

        if (node.isNumber()) return node.asText();

        return "'" + node.asText().replace("'", "''") + "'";
    }

    /* ---------- Identifier quoting ---------- */

    private static String quote(String name, SqlDialect dialect) {
        return switch (dialect) {
            case MYSQL -> "`" + name + "`";
            case POSTGRES, SQLITE -> "\"" + name + "\"";
            case SQLSERVER -> "[" + name + "]";
            default -> name;
        };
    }

}

