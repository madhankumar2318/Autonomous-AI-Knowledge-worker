package com.knowledge.worker.converter;

import com.knowledge.worker.service.EncryptionService;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.RequiredArgsConstructor;

/**
 * EncryptedStringConverter
 *
 * JPA AttributeConverter that transparently encrypts String fields before
 * writing to the database and decrypts them on read.
 *
 * Apply to a JPA field with:
 *   {@code @Convert(converter = EncryptedStringConverter.class)}
 */
@Converter
@RequiredArgsConstructor
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    private final EncryptionService encryptionService;

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        return encryptionService.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        return encryptionService.decrypt(dbData);
    }
}
