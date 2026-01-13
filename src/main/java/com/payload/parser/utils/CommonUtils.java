package com.payload.parser.utils;

import com.fasterxml.jackson.databind.ObjectMapper;

public class CommonUtils    {
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

}
