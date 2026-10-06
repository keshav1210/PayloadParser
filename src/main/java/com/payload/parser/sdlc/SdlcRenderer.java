package com.payload.parser.sdlc;

import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Minimal template language for the kit:
 * <ul>
 *   <li>{@code {{#if flag}} … {{/if}}} and {@code {{#unless flag}} … {{/unless}}}, nestable. When the opening tag
 *   ends its line, the tag lines are removed with the block, so table rows can be switched on and off.</li>
 *   <li>{@code {{name}}} inserts a value. Values are inserted in a single pass and never re-scanned.</li>
 * </ul>
 */
public final class SdlcRenderer {

    private static final Pattern BLOCK = Pattern.compile(
            "\\{\\{#(if|unless) ([\\w-]+)\\}\\}(\\n?)((?:(?!\\{\\{#(?:if|unless) )[\\s\\S])*?)\\{\\{/\\1\\}\\}(\\n?)");
    private static final Pattern VARIABLE = Pattern.compile("\\{\\{([A-Za-z][\\w]*)\\}\\}");

    private SdlcRenderer() {
    }

    public static String render(String text, Set<String> flags, Map<String, String> values) {
        String current = text;
        while (true) {
            Matcher m = BLOCK.matcher(current);
            StringBuilder out = new StringBuilder();
            boolean found = false;
            while (m.find()) {
                found = true;
                boolean on = flags.contains(m.group(2)) == m.group(1).equals("if");
                String body = m.group(4);
                String replacement = m.group(3).isEmpty() ? (on ? body : "") + m.group(5) : (on ? body : "");
                m.appendReplacement(out, Matcher.quoteReplacement(replacement));
            }
            m.appendTail(out);
            current = out.toString();
            if (!found) break;
        }
        Matcher v = VARIABLE.matcher(current);
        StringBuilder out = new StringBuilder();
        while (v.find()) {
            String value = values.get(v.group(1));
            v.appendReplacement(out, Matcher.quoteReplacement(value == null ? v.group() : value));
        }
        v.appendTail(out);
        return out.toString();
    }
}
