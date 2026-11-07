package org.springframework.security.core; import java.util.Collection; public interface Authentication { String getName(); Collection<? extends GrantedAuthority> getAuthorities(); }
