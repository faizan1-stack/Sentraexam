import factory
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.academic_calendar.models import AcademicTerm, AcademicYear
from apps.assessments.models import Assessment
from apps.courses.models import Course, CourseEnrollment
from apps.departments.models import Department

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        django_get_or_create = ("email",)

    email = factory.Sequence(lambda n: f"user{n}@example.com")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    role = User.Role.STUDENT
    is_active = True

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        pwd = extracted or "password123"
        self.set_password(pwd)
        if create:
            self.save()


class DepartmentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Department

    name = factory.Sequence(lambda n: f"Department {n}")
    code = factory.Sequence(lambda n: f"DPT{n:02d}")


class CourseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Course

    department = factory.SubFactory(DepartmentFactory)
    code = factory.Sequence(lambda n: f"COURSE{n:03d}")
    title = factory.Faker("sentence", nb_words=4)
    description = factory.Faker("paragraph")
    status = Course.Status.ACTIVE

    @factory.post_generation
    def assigned_teacher(self, create, extracted, **kwargs):
        if extracted:
            self.assigned_teacher = extracted
            if create:
                self.save()


class CourseEnrollmentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CourseEnrollment

    course = factory.SubFactory(CourseFactory)
    student = factory.SubFactory(UserFactory)


class AcademicYearFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = AcademicYear

    name = factory.Sequence(lambda n: f"202{n}/202{n+1}")
    start_date = timezone.now().date()
    end_date = factory.LazyAttribute(lambda o: o.start_date.replace(year=o.start_date.year + 1))


class AcademicTermFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = AcademicTerm

    academic_year = factory.SubFactory(AcademicYearFactory)
    name = "Term 1"
    start_date = factory.LazyAttribute(lambda o: o.academic_year.start_date)
    end_date = factory.LazyAttribute(lambda o: o.academic_year.end_date)


class AssessmentFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Assessment

    course = factory.SubFactory(CourseFactory)
    title = factory.Faker("sentence", nb_words=5)
    assessment_type = Assessment.AssessmentType.EXAM
    description = factory.Faker("paragraph")
    instructions = factory.Faker("paragraph")
    content = factory.LazyFunction(
        lambda: [
            {
                "title": "Overview",
                "body": "Please follow the instructions carefully.",
                "content_type": "INSTRUCTION",
            }
        ]
    )
    @factory.lazy_attribute
    def submission_format(self):
        if self.assessment_type == Assessment.AssessmentType.EXAM:
            return Assessment.SubmissionFormat.ONLINE
        return Assessment.SubmissionFormat.TEXT
    @factory.lazy_attribute
    def questions(self):
        if self.assessment_type == Assessment.AssessmentType.EXAM:
            return [
                {
                    "prompt": "What is 2 + 2?",
                    "options": [
                        {"text": "3", "is_correct": False},
                        {"text": "4", "is_correct": True},
                        {"text": "5", "is_correct": False},
                    ],
                }
            ]
        return []
    created_by = factory.SubFactory(UserFactory, role=User.Role.TEACHER)
