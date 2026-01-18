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

    private static void writeObject(StringBuilder toml, JsonNode node, String prefix) {
        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();

        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String key = entry.getKey();
            JsonNode value = entry.getValue();
            String fullKey = prefix.isEmpty() ? key : prefix + "." + key;

            if (value.isValueNode()) {
                writePrimitive(toml, fullKey, value);
            }
        }

        fields = node.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            JsonNode value = entry.getValue();
            String key = entry.getKey();
            String fullKey = prefix.isEmpty() ? key : prefix + "." + key;

            if (value.isObject()) {
                toml.append("\n[").append(fullKey).append("]\n");
                writeObject(toml, value, fullKey);
            }

            if (value.isArray()) {
                writeArray(toml, fullKey, value);
            }
        }
    }

    private static void writeArray(StringBuilder toml, String key, JsonNode array) {
        if (array.isEmpty()) return;

        JsonNode first = array.get(0);

        if (first.isValueNode()) {
            writePrimitiveArray(toml, key, array);
        } else if (first.isObject()) {
            for (JsonNode item : array) {
                if (!item.isObject())
                    throw new IllegalArgumentException("Mixed arrays not allowed in TOML: " + key);

                toml.append("\n[[")
                        .append(key)
                        .append("]]\n");

                writeObject(toml, item, key);
            }
        } else {
            throw new IllegalArgumentException("Unsupported array type: " + key);
        }
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
