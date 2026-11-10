/**
 * Course catalogue.
 *
 * Content lives in `src/content/` (Starlight docs for the curriculum, blog
 * collection for announcements). This file is the single source of truth for
 * navigation, progress tracking and the learner dashboard, so adding a week is
 * a two-line change plus the Markdown file.
 */

export interface Lesson {
  /** Stable identifier stored in progress records; never rename once shipped. */
  id: string;
  title: string;
  href: string;
}

export interface Week {
  id: string;
  title: string;
  summary: string;
  lessons: Lesson[];
}

export interface Course {
  slug: string;
  title: string;
  tagline: string;
  level: "Beginner" | "Advanced";
  format: string;
  status: "live" | "preview";
  /** First link a learner should open. */
  startHref: string;
  weeks: Week[];
}

function week(number: number, title: string, summary: string): Week {
  return {
    id: `24b-w${number}`,
    title: `Week ${number} · ${title}`,
    summary,
    lessons: [
      {
        id: `24b-w${number}`,
        title,
        href: `/24b/week${number}`,
      },
    ],
  };
}

export const courses: Course[] = [
  {
    slug: "24b",
    title: "Python Foundations",
    tagline:
      "A seven-week introduction to Python for people who have never written code.",
    level: "Beginner",
    format: "Weekly live session + recording, ~2 hours per week",
    status: "live",
    startHref: "/24b/week1",
    weeks: [
      week(1, "Getting set up", "Install Python, run your first script, meet the REPL."),
      week(2, "Values and variables", "Numbers, strings, booleans and naming things well."),
      week(3, "Making decisions", "Conditionals, comparison operators and truthiness."),
      week(4, "Loops", "for and while, ranges, and avoiding infinite loops."),
      week(5, "Collections", "Lists, dictionaries, tuples and slicing."),
      week(6, "Functions", "Parameters, return values, scope and small modules."),
      week(7, "Your first project", "Putting it together and submitting for certification."),
    ],
  },
  {
    slug: "advanced",
    title: "Python in Practice",
    tagline:
      "A four-week follow-on covering files, errors, libraries and testing.",
    level: "Advanced",
    format: "Recorded sessions, ~2 hours per week",
    status: "preview",
    startHref: "/buy",
    weeks: [],
  },
];

export function getCourse(slug: string): Course | undefined {
  return courses.find((course) => course.slug === slug);
}

export function allLessonIds(): Set<string> {
  const ids = new Set<string>();
  for (const course of courses) {
    for (const week of course.weeks) {
      for (const lesson of week.lessons) ids.add(lesson.id);
    }
  }
  return ids;
}

/** Number of lessons in a course (used for progress percentages). */
export function lessonCount(course: Course): number {
  return course.weeks.reduce((total, week) => total + week.lessons.length, 0);
}

/** Lessons a learner has completed, restricted to the course. */
export function completedInCourse(
  course: Course,
  progress: Record<string, string>,
): number {
  return course.weeks.reduce(
    (total, week) =>
      total +
      week.lessons.filter((lesson) => progress[lesson.id] === "done").length,
    0,
  );
}
