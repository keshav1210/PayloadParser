package com.payload.parser.enumration;

public enum SqlDialect {
    MYSQL, POSTGRES, SQLSERVER, SQLITE;

    public static SqlDialect fromString(String value) {
        if (value == null || value.trim().isEmpty()) {
            return MYSQL;
        }

        try {
            return SqlDialect.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(
                    "Unsupported SqlDialect: " + value +
                            ". Supported values are: MYSQL, POSTGRES, SQLSERVER, SQLITE"
            );
        }
    }

    }
