package com.payload.parser.serviceImpl;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;
import com.payload.parser.model.Request;
import com.payload.parser.model.Response;
import com.payload.parser.service.ParserService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.StringWriter;
import java.util.Stack;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class JsonFormatServiceImpl implements ParserService {
    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public Response parse(Request request) {
        try {
            String input= repair(request.getData());
            Object jsonObject = mapper.readValue(input, Object.class);
            ObjectWriter writer = mapper.writerWithDefaultPrettyPrinter();
            return new Response(true, "success", writer.writeValueAsString(jsonObject).replace("\r\n", "\n"), HttpStatus.OK.toString());
        } catch (Exception e) {
            throw new RuntimeException("Invalid JSON input");
        }
    }

    @Override
    public String getType() {
        return "JSON_FORMAT";
    }
    /**
     * Comprehensive JSON repair method
     */
    public String repair(String brokenJson) {
        if (brokenJson == null || brokenJson.trim().isEmpty()) {
            return "{}";
        }

        String repaired = brokenJson.trim();

        // Step 1: Fix missing quotes in values
        repaired = fixMissingQuotesInValues(repaired);

        // Step 2: Replace single quotes with double quotes
        repaired = replaceSingleQuotes(repaired);

        // Step 3: Add quotes around unquoted keys
        repaired = quoteKeys(repaired);

        // Step 4: Remove trailing commas
        repaired = removeTrailingCommas(repaired);

        // Step 5: Fix unclosed strings
        repaired = fixUnclosedStrings(repaired);

        // Step 6: Fix structural issues using state machine
        repaired = fixStructuralIssuesStateMachine(repaired);

        // Step 7: Remove comments
        repaired = removeComments(repaired);

        return repaired;
    }

    /**
     * State machine approach to fix structural issues
     */
    private String fixStructuralIssuesStateMachine(String json) {
        StringBuilder result = new StringBuilder();
        Stack<Character> stack = new Stack<>();
        boolean inString = false;
        boolean escaped = false;
        boolean afterValue = false;  // Track if we just finished a value

        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);

            if (escaped) {
                result.append(c);
                escaped = false;
                continue;
            }

            if (c == '\\') {
                result.append(c);
                escaped = true;
                continue;
            }

            if (c == '"') {
                inString = !inString;
                result.append(c);
                if (!inString) {
                    // Just closed a string - check if it was a value
                    if (!stack.isEmpty() && isAfterColon(result)) {
                        afterValue = true;
                    }
                }
                continue;
            }

            if (inString) {
                result.append(c);
                continue;
            }

            // Not in string - handle structural characters

            if (c == '{') {
                stack.push('{');
                afterValue = false;
                result.append(c);
            } else if (c == '[') {
                stack.push('[');
                afterValue = false;
                result.append(c);
            } else if (c == '}') {
                if (!stack.isEmpty() && stack.peek() == '{') {
                    stack.pop();
                }
                afterValue = true;
                result.append(c);
            } else if (c == ']') {
                // Close any open objects before closing array
                while (!stack.isEmpty() && stack.peek() == '{') {
                    stack.pop();
                    result.append('}');
                }
                if (!stack.isEmpty() && stack.peek() == '[') {
                    stack.pop();
                }
                afterValue = true;
                result.append(c);
            } else if (c == ',') {
                // Before comma, check if we need to close an object
                if (!stack.isEmpty() && stack.peek() == '{' && afterValue) {
                    // Look ahead to see what comes after comma
                    int nextPos = i + 1;
                    while (nextPos < json.length() && Character.isWhitespace(json.charAt(nextPos))) {
                        nextPos++;
                    }

                    if (nextPos < json.length() && json.charAt(nextPos) == '{') {
                        // Comma followed by { means we need to close current object
                        result.append('}');
                        stack.pop();
                    }
                }
                afterValue = false;
                result.append(c);
            } else if (c == ':') {
                afterValue = false;
                result.append(c);
            } else if (c == 't' || c == 'f' || c == 'n' || Character.isDigit(c) || c == '-') {
                // Start of true/false/null/number
                result.append(c);
                // Mark that we're in a value
                int valueEnd = i + 1;
                while (valueEnd < json.length()) {
                    char ch = json.charAt(valueEnd);
                    if (ch == ',' || ch == '}' || ch == ']' || Character.isWhitespace(ch)) {
                        break;
                    }
                    valueEnd++;
                }
                // Copy rest of value
                while (i + 1 < valueEnd && i + 1 < json.length()) {
                    i++;
                    result.append(json.charAt(i));
                }
                afterValue = true;
            } else if (!Character.isWhitespace(c)) {
                result.append(c);
            } else {
                result.append(c);
            }
        }

        // Close all remaining open structures
        while (!stack.isEmpty()) {
            char open = stack.pop();
            if (open == '{') {
                result.append('}');
            } else if (open == '[') {
                result.append(']');
            }
        }

        return result.toString();
    }

    /**
     * Check if we just processed a value (after a colon)
     */
    private boolean isAfterColon(StringBuilder sb) {
        // Look backward for colon before last quote
        int len = sb.length();
        if (len < 2) return false;

        // Go back past the quote we just added
        int pos = len - 2;

        // Skip the string content
        boolean inStr = false;
        while (pos >= 0) {
            char c = sb.charAt(pos);
            if (c == '"' && (pos == 0 || sb.charAt(pos - 1) != '\\')) {
                if (inStr) {
                    pos--;
                    break;
                } else {
                    inStr = true;
                }
            }
            pos--;
        }

        // Skip whitespace
        while (pos >= 0 && Character.isWhitespace(sb.charAt(pos))) {
            pos--;
        }

        // Check if we find colon
        return pos >= 0 && sb.charAt(pos) == ':';
    }

    /**
     * Fix missing quotes in values
     */
    private String fixMissingQuotesInValues(String json) {
        StringBuilder result = new StringBuilder();
        int i = 0;

        while (i < json.length()) {
            char c = json.charAt(i);

            if (c == '"') {
                int quoteEnd = findClosingQuote(json, i);
                if (quoteEnd == -1) {
                    result.append(c);
                    i++;
                    continue;
                }

                int afterQuote = quoteEnd + 1;
                while (afterQuote < json.length() && Character.isWhitespace(json.charAt(afterQuote))) {
                    afterQuote++;
                }

                if (afterQuote < json.length() && json.charAt(afterQuote) == ':') {
                    result.append(json, i, afterQuote + 1);
                    i = afterQuote + 1;

                    while (i < json.length() && Character.isWhitespace(json.charAt(i))) {
                        result.append(json.charAt(i));
                        i++;
                    }

                    if (i < json.length()) {
                        char valueStart = json.charAt(i);

                        if (valueStart != '"' && valueStart != '[' && valueStart != '{'
                                && valueStart != 't' && valueStart != 'f' && valueStart != 'n'
                                && !Character.isDigit(valueStart) && valueStart != '-') {

                            int valueEnd = i;
                            while (valueEnd < json.length()) {
                                char ch = json.charAt(valueEnd);
                                if (ch == '"') {
                                    result.append('"');
                                    result.append(json, i, valueEnd + 1);
                                    i = valueEnd + 1;
                                    break;
                                } else if (ch == ',' || ch == '}' || ch == ']' || ch == '\n') {
                                    result.append('"');
                                    result.append(json, i, valueEnd);
                                    result.append('"');
                                    i = valueEnd;
                                    break;
                                }
                                valueEnd++;
                            }

                            if (valueEnd >= json.length()) {
                                result.append('"');
                                result.append(json.substring(i));
                                result.append('"');
                                break;
                            }
                        } else {
                            result.append(valueStart);
                            i++;
                        }
                    }
                } else {
                    result.append(json, i, quoteEnd + 1);
                    i = quoteEnd + 1;
                }
            } else {
                result.append(c);
                i++;
            }
        }

        return result.toString();
    }

    private int findClosingQuote(String json, int startQuote) {
        boolean escaped = false;
        for (int i = startQuote + 1; i < json.length(); i++) {
            char c = json.charAt(i);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (c == '\\') {
                escaped = true;
                continue;
            }
            if (c == '"') {
                return i;
            }
        }
        return -1;
    }

    private String replaceSingleQuotes(String json) {
        StringBuilder result = new StringBuilder();
        boolean inDoubleQuote = false;
        boolean escaped = false;

        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);

            if (escaped) {
                result.append(c);
                escaped = false;
                continue;
            }

            if (c == '\\') {
                escaped = true;
                result.append(c);
                continue;
            }

            if (c == '"') {
                inDoubleQuote = !inDoubleQuote;
                result.append(c);
            } else if (c == '\'' && !inDoubleQuote) {
                result.append('"');
            } else {
                result.append(c);
            }
        }

        return result.toString();
    }

    private String quoteKeys(String json) {
        Pattern pattern = Pattern.compile("([{,]\\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*:");
        Matcher matcher = pattern.matcher(json);
        StringBuffer sb = new StringBuffer();

        while (matcher.find()) {
            String prefix = matcher.group(1);
            String key = matcher.group(2);
            matcher.appendReplacement(sb, prefix + "\"" + key + "\":");
        }
        matcher.appendTail(sb);

        return sb.toString();
    }

    private String removeTrailingCommas(String json) {
        return json.replaceAll(",\\s*([}\\]])", "$1");
    }

    private String fixUnclosedStrings(String json) {
        StringBuilder result = new StringBuilder();
        boolean inString = false;
        boolean escaped = false;

        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);

            if (escaped) {
                result.append(c);
                escaped = false;
                continue;
            }

            if (c == '\\' && inString) {
                escaped = true;
                result.append(c);
                continue;
            }

            if (c == '"') {
                inString = !inString;
                result.append(c);
                continue;
            }

            if (inString) {
                if (c == ',' || c == '}' || c == ']' || c == '{' || c == '\n' || c == '\r') {
                    result.append('"');
                    inString = false;
                }
            }

            result.append(c);
        }

        if (inString) {
            result.append('"');
        }

        return result.toString();
    }

    private String removeComments(String json) {
        json = json.replaceAll("//.*?(\n|$)", "$1");
        json = json.replaceAll("/\\*.*?\\*/", "");
        return json;
    }
}