import { Link, useParams } from 'react-router-dom';
import { useCatalogue } from '../hooks/useCatalogue';
import { PracticeRunner } from '../components/PracticeRunner';
import { Spinner } from '../components/Spinner';

export function LessonDetailPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { catalogue, loading } = useCatalogue();

  const lesson = catalogue?.lessons.find((l) => l.id === lessonId);

  if (loading) return <div className="page"><Spinner label="Loading lesson" /></div>;

  if (!lesson) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>That lesson does not exist.</p>
          <Link className="btn btn-secondary" to="/lessons">
            Back to lessons
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Link className="back-link" to="/lessons">
        ← All lessons
      </Link>

      <header className="page-head">
        <div>
          <span className={`level-badge level-${lesson.level}`}>{lesson.level}</span>
          <h1>{lesson.title}</h1>
          <p className="muted">{lesson.why}</p>
        </div>
      </header>

      <PracticeRunner
        type="lesson"
        lessonId={lesson.id}
        title={lesson.title}
        prompt={lesson.prompt}
        tips={lesson.tips}
        rubric={lesson.rubric}
      />
    </div>
  );
}
