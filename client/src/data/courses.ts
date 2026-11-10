/**
 * Course catalogue.
 *
 * Content lives in `src/content/` (Starlight docs for the curriculum, blog
 * collection for announcements). This file is the single source of truth for
 * navigation, progress tracking, the learner dashboard and the purchase page,
 * so adding a week is a two-line change plus the Markdown file.
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
  /** Short, scannable outcomes shown on the home and purchase pages. */
  outcomes: string[];
  /** Details only needed by the purchase page. */
  purchase?: {
    hostedButtonId: string;
    description: string;
    meta: string[];
  };
  weeks: Week[];
}

function week(
  course: string,
  number: number,
  path: string,
  title: string,
  summary: string,
): Week {
  const id = `${course}-w${number}`;
  return {
    id,
    title,
    summary,
    lessons: [{ id, title, href: path }],
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
    outcomes: [
      "Read and write Python confidently",
      "Variables, types and control flow",
      "Loops, lists, dictionaries and functions",
      "Modules, file handling and a final project",
    ],
    purchase: {
      hostedButtonId: "RMJ7LXNMAHFUN",
      description:
        "A seven-week introductory course to Python, ideal for those with little or no prior programming experience. By committing only 2 hours per week you will learn all the skills you need to start making your own Python projects. Sessions are held both in person and online, and every session is recorded for students who miss a live one. Everyone who attends the lectures receives a certificate of completion, and handing in the final project earns a certificate of commendation.",
      meta: ["7 weeks", "~2 hours per week", "Live + recorded"],
    },
    weeks: [
      week(
        "24b",
        1,
        "/24b/week1",
        "Getting set up",
        "Install Python and VS Code, meet the terminal, and write your first script: data types, variables, type casting, input/output and strings.",
      ),
      week(
        "24b",
        2,
        "/24b/week2",
        "Control flow",
        "if / elif / else, comparison and boolean operators, short-circuiting, ternary expressions and match/case.",
      ),
      week(
        "24b",
        3,
        "/24b/week3",
        "Loops",
        "while and for, range, nested loops, break and continue, plus trace tables for dry-running your code.",
      ),
      week(
        "24b",
        4,
        "/24b/week4",
        "Collections",
        "Lists, tuples and sets: indexing, slicing, nested lists, enumeration and set operations.",
      ),
      week(
        "24b",
        5,
        "/24b/week5",
        "Functions and dictionaries",
        "Defining functions, parameters, default arguments, scope, return values, recursion, and key/value data.",
      ),
      week(
        "24b",
        6,
        "/24b/week6",
        "Modules and files",
        "Splitting code into modules and working with files on disk: reading, writing and processing real data.",
      ),
      week(
        "24b",
        7,
        "/24b/week7",
        "Final project",
        "Pull the whole course together into a project you can show off, and submit it for your certificate.",
      ),
    ],
  },
  {
    slug: "advanced",
    title: "Python in Practice",
    tagline:
      "A five-part follow-on: write classes, work with spreadsheets, chart data, ship an app and add AI.",
    level: "Advanced",
    format: "Recorded sessions, ~2 hours per module",
    status: "live",
    startHref: "/advanced/oop",
    outcomes: [
      "Design classes and model real problems",
      "Read and write Excel workbooks",
      "Chart data with matplotlib",
      "Ship an app other people can run",
      "Call AI models from Python",
    ],
    purchase: {
      hostedButtonId: "PUADREGKBLFKQ",
      description:
        "A five-module follow-on for people who finished the beginner course. You will move from standalone functions to classes, then put Python to work on real data: reading and writing Excel workbooks, charting results with matplotlib, packaging everything into an app with SQLite and a Streamlit or tkinter front end, and finally training a first model and calling a language model API. Sessions are recorded, and each module ends with a project you can put on GitHub.",
      meta: ["5 modules", "Recorded sessions", "Project per module"],
    },
    weeks: [
      week(
        "advanced",
        1,
        "/advanced/oop",
        "Object-oriented Python",
        "Classes, instances, methods, inheritance and dataclasses — the step up from standalone functions.",
      ),
      week(
        "advanced",
        2,
        "/advanced/excel",
        "Excel and files",
        "Read and write spreadsheets with openpyxl, process CSV, and turn a workbook into a clean report.",
      ),
      week(
        "advanced",
        3,
        "/advanced/matplotlib",
        "Charts with matplotlib",
        "Line, bar, scatter and histogram plots, subplots, styling, and plotting straight from pandas.",
      ),
      week(
        "advanced",
        4,
        "/advanced/apps",
        "Building an app",
        "Structure a project, store data in SQLite, handle errors, and give it a tkinter or Streamlit front end.",
      ),
      week(
        "advanced",
        5,
        "/advanced/ai",
        "AI with Python",
        "Train a first scikit-learn model, call a language model API safely, and build a small course assistant.",
      ),
    ],
  },
];

export function getCourse(slug: string | undefined): Course | undefined {
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

/** True when the member owns this course. */
export function ownsCourse(
  courses: readonly string[] | undefined,
  slug: string,
): boolean {
  return Boolean(courses?.includes(slug));
}
