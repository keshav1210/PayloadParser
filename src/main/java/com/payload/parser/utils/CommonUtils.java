package com.payload.parser.utils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;

import java.io.IOException;
import java.io.StringWriter;
import java.util.*;

public class CommonUtils {
    public static boolean isEscapedJson(String input) {
        return input.startsWith("\"") &&
                (input.contains("\\\"") || input.contains("\\n") || input.contains("\\t"));
    }

    public static String unescapeString(String input) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        return mapper.readValue(input, String.class);
    }

    public static boolean isEscapedXml(String input) {
        return input.startsWith("\"") &&
                (input.contains("\\<") || input.contains("\\>") || input.contains("\\\""));
    }

    public static Map<String, Object> flatten(JsonNode node, String prefix) {
        Map<String, Object> flat = new LinkedHashMap<>();
        flattenNode(node, prefix, flat);
        return flat;
    }

    public static void flattenNode(JsonNode node, String prefix, Map<String, Object> flat) {
        if (node.isObject()) {
            ObjectNode obj = (ObjectNode) node;
            obj.fields().forEachRemaining(entry -> {
                String key = prefix.isEmpty() ? entry.getKey() : prefix + "." + entry.getKey();
                flattenNode(entry.getValue(), key, flat);
            });
        } else if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) {
                String key = prefix + "[" + i + "]";
                flattenNode(node.get(i), key, flat);
            }
        } else {
            flat.put(prefix, node.asText());
        }
    }

    public static CSVFormat getCsvFormat(String delimiter) {
        return switch (delimiter.toUpperCase()) {
            case "SEMICOLON" -> CSVFormat.DEFAULT.withDelimiter(';');
            case "TAB" -> CSVFormat.TDF;
            case "PIPE" -> CSVFormat.DEFAULT.withDelimiter('|');
            default -> CSVFormat.DEFAULT; // COMMA
        };
    }

    public static String buidCsv(List<Map<String, Object>> rows, String delimiter) throws IOException {
        // Get headers from first row
        Set<String> headers = new LinkedHashSet<>(rows.get(0).keySet());
        List<String> headerList = new ArrayList<>(headers);

        // Build CSV
        StringWriter sw = new StringWriter();
        CSVFormat csvFormat = CommonUtils.getCsvFormat(delimiter);
        try (CSVPrinter printer = new CSVPrinter(sw, csvFormat)) {
            printer.printRecord(headerList);
            for (Map<String, Object> row : rows) {
                List<String> csvRow = new ArrayList<>();
                for (String header : headerList) {
                    csvRow.add(String.valueOf(row.getOrDefault(header, "")));
                }
                printer.printRecord(csvRow);
            }
        }
        return sw.toString();
    }

}
