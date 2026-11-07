package jakarta.validation.constraints; import java.lang.annotation.*; @Retention(RetentionPolicy.RUNTIME) public @interface NotBlank { String message() default ""; }
