from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("proctoring", "0008_proctoringvideoclip"),
    ]

    operations = [
        migrations.AlterField(
            model_name="proctoringsettings",
            name="max_violations_before_terminate",
            field=models.PositiveIntegerField(
                default=3,
                help_text="Auto-terminate exam after this many violations",
            ),
        ),
        migrations.AlterField(
            model_name="proctoringviolation",
            name="violation_type",
            field=models.CharField(
                choices=[
                    ("NO_FACE", "No face detected"),
                    ("MULTIPLE_FACES", "Multiple faces detected"),
                    ("LOOKING_AWAY", "Looking away from screen"),
                    ("FACE_NOT_MATCHED", "Face does not match registered student"),
                    ("AUDIO_TALKING", "Background talking detected"),
                    ("CAMERA_OFF", "Camera turned off or unavailable"),
                    ("TAB_SWITCH", "Browser tab switch detected"),
                    ("FOCUS_LOSS", "Screen focus lost or browser switched"),
                    ("OBJECT_DETECTED", "Suspicious object detected"),
                    ("PHONE_DETECTED", "Phone detected in frame"),
                    ("BOOK_DETECTED", "Book or notes detected in frame"),
                    ("LAPTOP_DETECTED", "Secondary device detected"),
                    ("PERSON_LEFT", "Person left the frame"),
                    ("INTERMITTENT_FACE", "Face frequently disappearing"),
                    ("PERSISTENT_GAZE_AWAY", "Consistently looking away"),
                    ("MULTIPLE_PERSONS_PATTERN", "Multiple people detected over time"),
                    ("IDENTITY_MISMATCH_PATTERN", "Repeated face verification failures"),
                ],
                max_length=30,
            ),
        ),
    ]
