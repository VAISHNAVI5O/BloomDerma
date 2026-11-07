package com.bloomderma.api.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;
import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain chain(HttpSecurity http, JwtAuthenticationFilter jwtFilter) throws Exception {
        http.csrf(c -> c.disable())
            .cors(c -> {})
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            .authorizeHttpRequests(a -> a
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/doctors/specialities").permitAll()   // plain list of speciality names
                // Patient portal: a PATIENT account can reach ONLY these (and read-only doctor/service lookups below).
                .requestMatchers("/api/portal/**").hasRole("PATIENT")
                .requestMatchers("/api/video/**").hasAnyRole("PATIENT", "DOCTOR")
                // Role-based access (RBAC)
                .requestMatchers(HttpMethod.DELETE, "/api/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/api/doctors/**", "/api/services/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.PUT, "/api/doctors/**").hasRole("ADMIN")
                // Only ADMIN / RECEPTIONIST (/ legacy STAFF) may create or change bookings and patient records.
                // Doctors get 403 here even if they call the API by hand.
                .requestMatchers(HttpMethod.POST, "/api/patients/*/reports/**").hasRole("DOCTOR")   // doctor writes a report for a patient
                .requestMatchers(HttpMethod.POST, "/api/patients/*/revisits").hasRole("DOCTOR")      // doctor suggests a revisit (patient is only notified)
                .requestMatchers(HttpMethod.POST, "/api/appointments", "/api/appointments/**", "/api/patients", "/api/patients/**")
                    .hasAnyRole("ADMIN", "RECEPTIONIST", "STAFF")
                .requestMatchers(HttpMethod.PUT, "/api/appointments/**", "/api/patients/**")
                    .hasAnyRole("ADMIN", "RECEPTIONIST", "STAFF")
                .requestMatchers(HttpMethod.PATCH, "/api/appointments/*/payment")
                    .hasAnyRole("ADMIN", "RECEPTIONIST", "STAFF")        // recording payment / due amount: front desk only
                .requestMatchers(HttpMethod.GET, "/api/doctors/suggestions")
                    .hasAnyRole("ADMIN", "RECEPTIONIST", "STAFF", "PATIENT")
                .requestMatchers(HttpMethod.GET, "/api/doctors", "/api/services", "/api/reviews")
                    .hasAnyRole("ADMIN", "RECEPTIONIST", "STAFF", "DOCTOR", "PATIENT")
                // everything else (patients, appointments, revenue, history, reports...) is for clinic staff and doctors only
                .anyRequest().hasAnyRole("ADMIN", "RECEPTIONIST", "STAFF", "DOCTOR"))
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

    /** CORS: lets the React dev server (another origin) call this API. */
    @Bean
    CorsConfigurationSource corsSource(@Value("${bloomderma.cors.allowed-origins}") List<String> origins) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(origins);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}
