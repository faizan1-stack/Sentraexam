"""
Management command to create test assessments/exams for testing.
"""
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.users.models import User
from apps.departments.models import Department
from apps.courses.models import Course, CourseEnrollment
from apps.assessments.models import Assessment, ExamAssignment


class Command(BaseCommand):
    help = "Create test assessments for all courses"

    def handle(self, *args, **options):
        # Get or create department
        dept, _ = Department.objects.get_or_create(
            name="Computer Science",
            defaults={"code": "CS", "description": "Computer Science Department"}
        )
        
        # Get teacher
        teacher = User.objects.filter(role=User.Role.TEACHER).first()
        if not teacher:
            self.stdout.write(self.style.ERROR("❌ No teacher found. Run create_test_accounts first."))
            return
        
        # Get students
        students = User.objects.filter(role=User.Role.STUDENT, is_active=True)
        if not students.exists():
            self.stdout.write(self.style.ERROR("❌ No students found. Run create_test_accounts first."))
            return
        
        # Create courses
        courses_data = [
            {"code": "CS101", "title": "Introduction to Programming", "credits": 3},
            {"code": "CS201", "title": "Data Structures & Algorithms", "credits": 4},
            {"code": "CS301", "title": "Database Systems", "credits": 3},
        ]
        
        courses = []
        for course_data in courses_data:
            course, created = Course.objects.get_or_create(
                code=course_data["code"],
                defaults={
                    "department": dept,
                    "title": course_data["title"],
                    "credits": course_data["credits"],
                    "status": Course.Status.ACTIVE,
                    "assigned_teacher": teacher,
                }
            )
            courses.append(course)
            if created:
                self.stdout.write(self.style.SUCCESS(f"✅ Created course: {course.code}"))
            else:
                self.stdout.write(self.style.WARNING(f"⚠️  Course exists: {course.code}"))
        
        # Enroll students in all courses
        for student in students:
            for course in courses:
                enrollment, created = CourseEnrollment.objects.get_or_create(
                    course=course,
                    student=student,
                    defaults={"status": CourseEnrollment.EnrollmentStatus.ENROLLED}
                )
                if created:
                    self.stdout.write(f"  📚 Enrolled {student.email} in {course.code}")
        
        # Create assessments
        now = timezone.now()
        
        assessments_data = [
            # CS101 Assessments
            {
                "course": courses[0],
                "title": "Programming Basics Quiz",
                "assessment_type": Assessment.AssessmentType.QUIZ,
                "description": "A quiz covering basic programming concepts",
                "duration_minutes": 30,
                "total_marks": 50,
                "status": Assessment.Status.SCHEDULED,
                "scheduled_at": now - timedelta(hours=1),
                "closes_at": now + timedelta(days=7),
                "questions": [
                    {"prompt": "What is a variable?", "type": "SUBJECTIVE", "marks": 10},
                    {"prompt": "Explain loops in programming", "type": "SUBJECTIVE", "marks": 15},
                    {"prompt": "What is a function?", "type": "SUBJECTIVE", "marks": 10},
                    {"prompt": "Difference between if-else and switch?", "type": "SUBJECTIVE", "marks": 15},
                ],
            },
            {
                "course": courses[0],
                "title": "Midterm Exam - Programming Fundamentals",
                "assessment_type": Assessment.AssessmentType.EXAM,
                "description": "Midterm examination covering chapters 1-5",
                "duration_minutes": 90,
                "total_marks": 100,
                "status": Assessment.Status.SCHEDULED,
                "scheduled_at": now - timedelta(hours=1),
                "closes_at": now + timedelta(days=14),
                "submission_format": "ONLINE",
                "questions": [
                    {"prompt": "Write a program to find factorial of a number", "type": "SUBJECTIVE", "marks": 20},
                    {"prompt": "Explain object-oriented programming concepts", "type": "SUBJECTIVE", "marks": 25},
                    {"prompt": "What are arrays? Give examples", "type": "SUBJECTIVE", "marks": 20},
                    {"prompt": "Write a function to check if a number is prime", "type": "SUBJECTIVE", "marks": 20},
                    {"prompt": "Explain the concept of recursion", "type": "SUBJECTIVE", "marks": 15},
                ],
            },
            # CS201 Assessments
            {
                "course": courses[1],
                "title": "Data Structures Quiz",
                "assessment_type": Assessment.AssessmentType.QUIZ,
                "description": "Quick quiz on linked lists and trees",
                "duration_minutes": 20,
                "total_marks": 30,
                "status": Assessment.Status.SCHEDULED,
                "scheduled_at": now - timedelta(hours=1),
                "closes_at": now + timedelta(days=5),
                "questions": [
                    {"prompt": "What is a linked list?", "type": "SUBJECTIVE", "marks": 10},
                    {"prompt": "Explain binary search tree", "type": "SUBJECTIVE", "marks": 10},
                    {"prompt": "Difference between stack and queue", "type": "SUBJECTIVE", "marks": 10},
                ],
            },
            {
                "course": courses[1],
                "title": "Algorithms Final Exam",
                "assessment_type": Assessment.AssessmentType.EXAM,
                "description": "Final examination - all topics",
                "duration_minutes": 120,
                "total_marks": 100,
                "status": Assessment.Status.SCHEDULED,
                "scheduled_at": now - timedelta(hours=1),
                "closes_at": now + timedelta(days=21),
                "submission_format": "ONLINE",
                "questions": [
                    {"prompt": "Explain Big O notation with examples", "type": "SUBJECTIVE", "marks": 20},
                    {"prompt": "Write binary search algorithm", "type": "SUBJECTIVE", "marks": 20},
                    {"prompt": "Explain Dijkstra's shortest path algorithm", "type": "SUBJECTIVE", "marks": 25},
                    {"prompt": "What is dynamic programming?", "type": "SUBJECTIVE", "marks": 20},
                    {"prompt": "Compare sorting algorithms", "type": "SUBJECTIVE", "marks": 15},
                ],
            },
            # CS301 Assessments
            {
                "course": courses[2],
                "title": "SQL Basics Quiz",
                "assessment_type": Assessment.AssessmentType.QUIZ,
                "description": "Quiz on SQL fundamentals",
                "duration_minutes": 25,
                "total_marks": 40,
                "status": Assessment.Status.SCHEDULED,
                "scheduled_at": now - timedelta(hours=1),
                "closes_at": now + timedelta(days=3),
                "questions": [
                    {"prompt": "Write a SELECT query with JOIN", "type": "SUBJECTIVE", "marks": 15},
                    {"prompt": "Explain normalization forms", "type": "SUBJECTIVE", "marks": 15},
                    {"prompt": "What is an index?", "type": "SUBJECTIVE", "marks": 10},
                ],
            },
            {
                "course": courses[2],
                "title": "Database Design Assignment",
                "assessment_type": Assessment.AssessmentType.ASSIGNMENT,
                "description": "Design a database schema for an e-commerce system",
                "duration_minutes": 180,
                "total_marks": 50,
                "status": Assessment.Status.SCHEDULED,
                "scheduled_at": now - timedelta(hours=1),
                "closes_at": now + timedelta(days=10),
                "questions": [
                    {"prompt": "Create an ER diagram for the system", "type": "SUBJECTIVE", "marks": 20},
                    {"prompt": "Write SQL statements to create tables", "type": "SUBJECTIVE", "marks": 20},
                    {"prompt": "Explain your design decisions", "type": "SUBJECTIVE", "marks": 10},
                ],
            },
        ]
        
        created_count = 0
        for assessment_data in assessments_data:
            course = assessment_data.pop("course")
            questions = assessment_data.pop("questions")
            scheduled_at = assessment_data.pop("scheduled_at")
            closes_at = assessment_data.pop("closes_at")
            
            assessment, created = Assessment.objects.get_or_create(
                course=course,
                title=assessment_data["title"],
                defaults={
                    **assessment_data,
                    "questions": questions,
                    "scheduled_at": scheduled_at,
                    "closes_at": closes_at,
                    "created_by": teacher,
                    "approved_by": teacher,
                    "approved_at": now,
                    "assign_to_all": True,
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(
                    f"✅ Created: {assessment.title} ({assessment.get_assessment_type_display()})"
                ))
                
                # Create exam assignments for all enrolled students
                enrollments = CourseEnrollment.objects.filter(course=course)
                for enrollment in enrollments:
                    ExamAssignment.objects.get_or_create(
                        assessment=assessment,
                        student=enrollment.student
                    )
            else:
                self.stdout.write(self.style.WARNING(f"⚠️  Exists: {assessment.title}"))
        
        self.stdout.write(self.style.SUCCESS(f"\n✅ Done! {created_count} assessments created."))
        self.stdout.write(f"   📝 Total assessments: {Assessment.objects.count()}")
        self.stdout.write(f"   📚 Total courses: {Course.objects.count()}")
