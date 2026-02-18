"""
Management command to create test user accounts for all roles.
"""
from django.core.management.base import BaseCommand
from apps.users.models import User
from apps.departments.models import Department


class Command(BaseCommand):
    help = "Create test user accounts for all roles"

    def handle(self, *args, **options):
        # Create a test department first
        dept, _ = Department.objects.get_or_create(
            name="Computer Science",
            defaults={"code": "CS", "description": "Computer Science Department"}
        )
        
        test_accounts = [
            {
                "email": "hod@gmail.com",
                "password": "hod12345",
                "first_name": "Head",
                "last_name": "Department",
                "role": User.Role.HOD,
                "department": dept,
            },
            {
                "email": "teacher@gmail.com",
                "password": "teacher123",
                "first_name": "John",
                "last_name": "Teacher",
                "role": User.Role.TEACHER,
                "department": dept,
            },
            {
                "email": "teacher2@gmail.com",
                "password": "teacher123",
                "first_name": "Jane",
                "last_name": "Instructor",
                "role": User.Role.TEACHER,
                "department": dept,
            },
            {
                "email": "student@gmail.com",
                "password": "student123",
                "first_name": "Alice",
                "last_name": "Student",
                "role": User.Role.STUDENT,
                "department": dept,
            },
            {
                "email": "student2@gmail.com",
                "password": "student123",
                "first_name": "Bob",
                "last_name": "Learner",
                "role": User.Role.STUDENT,
                "department": dept,
            },
        ]
        
        created_accounts = []
        
        for account_data in test_accounts:
            email = account_data.pop("email")
            password = account_data.pop("password")
            
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    **account_data,
                    "is_active": True,
                    "onboarding_completed": True,
                }
            )
            
            if created:
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"✅ Created: {email} ({user.role})"))
                created_accounts.append({"email": email, "password": password, "role": user.role})
            else:
                self.stdout.write(self.style.WARNING(f"⚠️  Already exists: {email}"))
                created_accounts.append({"email": email, "password": password, "role": user.role})
        
        self.stdout.write(self.style.SUCCESS(f"\n✅ Done! {len(created_accounts)} accounts ready."))
