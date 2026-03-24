from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("proctoring", "0005_add_image_url_to_snapshot"),
    ]

    operations = [
        migrations.AlterField(
            model_name="proctoringsettings",
            name="snapshot_interval_seconds",
            field=models.PositiveIntegerField(default=10, help_text="How often to capture snapshots (in seconds)"),
        ),
    ]
