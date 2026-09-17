package com.knowledge.worker.entity;

import com.knowledge.worker.converter.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 255)
    private String username;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String password;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(columnDefinition = "TEXT")
    private String name;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(columnDefinition = "TEXT")
    private String email;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(columnDefinition = "TEXT")
    private String mobile;
}
