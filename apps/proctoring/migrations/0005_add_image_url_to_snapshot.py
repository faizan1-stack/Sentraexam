from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("proctoring", "0004_session_recording"),
    ]

    operations = [
        migrations.AddField(
            model_name="proctoringsnapshot",
            name="image_url",
            field=models.URLField(blank=True, default=""),
        ),
    ]
