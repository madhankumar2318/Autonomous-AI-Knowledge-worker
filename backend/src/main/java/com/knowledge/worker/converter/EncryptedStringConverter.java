package com.knowledge.worker.converter;

import com.knowledge.worker.service.EncryptionService;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * EncryptedStringConverter
 *
 * JPA AttributeConverter that transparently encrypts String fields before
 * writing to the database and decrypts them on read.
 */
@Converter
@Component
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    private static EncryptionService staticEncryptionService;
    private EncryptionService encryptionService;

    public EncryptedStringConverter() {
        this.encryptionService = staticEncryptionService;
    }

    @Autowired
    public EncryptedStringConverter(EncryptionService encryptionService) {
        this.encryptionService = encryptionService;
        staticEncryptionService = encryptionService;
    }

    @Autowired
    public void setEncryptionService(EncryptionService encryptionService) {
        this.encryptionService = encryptionService;
        staticEncryptionService = encryptionService;
    }

    private EncryptionService getService() {
        return encryptionService != null ? encryptionService : staticEncryptionService;
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        EncryptionService service = getService();
        if (service == null) return attribute;
        return service.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        EncryptionService service = getService();
        if (service == null) return dbData;
        return service.decrypt(dbData);
    }
}
