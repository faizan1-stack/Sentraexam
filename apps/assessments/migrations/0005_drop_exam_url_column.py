from django.db import migrations, connection


def drop_exam_url_if_exists(apps, schema_editor):
    """Drop exam_url column if it exists - works with both PostgreSQL and SQLite."""
    table_name = "assessments_assessment"
    column_name = "exam_url"
    
    # Check if column exists
    if connection.vendor == 'postgresql':
        # PostgreSQL supports IF EXISTS
        schema_editor.execute(
            f'ALTER TABLE "{table_name}" DROP COLUMN IF EXISTS "{column_name}";'
        )
    else:
        # For SQLite and others, check if column exists first
        with connection.cursor() as cursor:
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [row[1] for row in cursor.fetchall()]
            if column_name in columns:
                # SQLite 3.35+ supports DROP COLUMN
                schema_editor.execute(
                    f'ALTER TABLE "{table_name}" DROP COLUMN "{column_name}";'
                )


def add_exam_url(apps, schema_editor):
    """Add exam_url column back (reverse migration)."""
    table_name = "assessments_assessment"
    schema_editor.execute(
        f'ALTER TABLE "{table_name}" ADD COLUMN "exam_url" varchar(200);'
    )


class Migration(migrations.Migration):

    dependencies = [
        ("assessments", "0003_assessment_content_fields"),
    ]

    operations = [
        migrations.RunPython(drop_exam_url_if_exists, add_exam_url),
    ]

