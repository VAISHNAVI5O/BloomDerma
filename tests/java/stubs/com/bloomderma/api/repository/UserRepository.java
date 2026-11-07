package com.bloomderma.api.repository; import com.bloomderma.api.model.User; import java.util.Optional; public interface UserRepository { Optional<User> findByUsername(String u); }
