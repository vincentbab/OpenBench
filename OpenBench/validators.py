from django.core.exceptions import ValidationError

class MixedCaseValidator:

    def validate(self, password, user=None):
        if not any(c.isupper() for c in password) or not any(c.islower() for c in password):
            raise ValidationError('This password must contain at least one uppercase and one lowercase letter.', code='password_no_mixed_case')

    def get_help_text(self):
        return 'Your password must contain at least one uppercase and one lowercase letter.'
