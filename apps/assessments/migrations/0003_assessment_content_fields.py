from django.db import migrations, models

import apps.assessments.models


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="assessment",
            name="content",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="assessment",
            name="instructions",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="assessment",
            name="questions",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="assessment",
            name="submission_format",
            field=models.CharField(
                choices=[
                    ("ONLINE", "Online exam session"),
                    ("TEXT", "Text response"),
                    ("FILE", "File upload"),
                    ("TEXT_AND_FILE", "Text + File"),
                ],
                default="TEXT",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="assessmentsubmission",
            name="file_response",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to=apps.assessments.models.submission_upload_to,
            ),
        ),
        migrations.AddField(
            model_name="assessmentsubmission",
            name="text_response",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="assessmentsubmission",
            name="answers",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
