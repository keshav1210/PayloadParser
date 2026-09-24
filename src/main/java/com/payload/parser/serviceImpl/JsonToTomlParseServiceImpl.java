package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@Service
public class JsonToTomlParseServiceImpl implements ParserService {
    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Response parse(Request request) {
        try{
            JsonNode root = mapper.readTree(request.getData());
            StringBuilder toml = new StringBuilder();

            if (root.isObject()) {
                writeObject(toml, root, "");
            } else if (root.isArray()) {
                throw new IllegalArgumentException(
                        "Top-level JSON array must be wrapped in an object for TOML"
                );
            } else {
                throw new IllegalArgumentException("Invalid top-level JSON");
            }

            return new Response(true, "success", toml.toString().trim(), HttpStatus.OK.toString());
        }catch (Exception e){
            throw new RuntimeException(e.getMessage());
        }
    }

    @Override
    public String getType() {
        return "JSON_TO_TOML";
    }

    // Keys inside a [table] are relative to it; only table headers use the full dotted path.
    // All plain key/values (including arrays of values) must come before any sub-table,
    // otherwise TOML assigns them to the last opened table.
    private static void writeObject(StringBuilder toml, JsonNode node, String prefix) {
        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();

        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String key = tomlKey(entry.getKey());
            JsonNode value = entry.getValue();

            if (value.isValueNode()) {
                writePrimitive(toml, key, value);
            } else if (value.isArray() && !value.isEmpty() && value.get(0).isValueNode()) {
                writePrimitiveArray(toml, key, value);
            }
        }

        fields = node.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            JsonNode value = entry.getValue();
            String key = tomlKey(entry.getKey());
            String fullKey = prefix.isEmpty() ? key : prefix + "." + key;

            if (value.isObject()) {
                toml.append("\n[").append(fullKey).append("]\n");
                writeObject(toml, value, fullKey);
            } else if (value.isArray() && !value.isEmpty() && !value.get(0).isValueNode()) {
                writeTableArray(toml, fullKey, value);
            }
        }
    }

    private static void writeTableArray(StringBuilder toml, String key, JsonNode array) {
        for (JsonNode item : array) {
            if (!item.isObject())
                throw new IllegalArgumentException("Mixed arrays not allowed in TOML: " + key);

            toml.append("\n[[")
                    .append(key)
                    .append("]]\n");

            writeObject(toml, item, key);
        }
    }

    private static String tomlKey(String key) {
        return key.matches("[A-Za-z0-9_-]+") ? key : "\"" + escape(key) + "\"";
    }

    private static void writePrimitive(StringBuilder toml, String key, JsonNode value) {
        if (value.isNull()) return; // TOML has no null

        toml.append(key)
                .append(" = ")
                .append(formatValue(value))
                .append("\n");
    }

    private static void writePrimitiveArray(StringBuilder toml, String key, JsonNode array) {
        List<String> values = new ArrayList<>();

        for (JsonNode item : array) {
            if (!item.isValueNode())
                throw new IllegalArgumentException("Mixed arrays not allowed: " + key);

            values.add(formatValue(item));
        }

        toml.append(key)
                .append(" = [")
                .append(String.join(", ", values))
                .append("]\n");
    }

    private static String formatValue(JsonNode value) {
        if (value.isTextual())
            return "\"" + escape(value.asText()) + "\"";

        if (value.isNumber())
            return value.numberValue().toString();

        if (value.isBoolean())
            return String.valueOf(value.asBoolean());

        throw new IllegalArgumentException("Unsupported value: " + value);
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\t", "\\t");
    }
}
