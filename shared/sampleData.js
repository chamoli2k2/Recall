export const sampleFolders = [
  { title: 'System design', description: 'The building blocks behind systems that scale.', color: 'violet', icon: 'layers', visibility: 'private', tags: ['architecture', 'interviews'], cards: [
    ['What is the difference between horizontal and vertical scaling?', 'Horizontal scaling adds more machines. Vertical scaling adds resources to an existing machine. Horizontal scaling introduces coordination overhead but can improve resilience.', ['scalability']],
    ['What does idempotency mean?', 'An operation is idempotent when repeating the same request has the same intended effect as executing it once. An idempotency key lets a server recognize retries.', ['apis', 'concurrency']],
    ['When would you use optimistic concurrency control?', 'When conflicts are relatively rare. Include a version with each write, and reject it if the stored version has changed since the read.', ['concurrency']],
    ['What is the purpose of a database index?', 'An index helps locate matching records without scanning every record. It uses extra storage and adds work to writes.', ['databases']],
    ['What is the transactional outbox pattern?', 'Write a domain change and its event to the same database transaction. A separate worker publishes committed events, with consumer deduplication for retries.', ['distributed-systems']],
    ['Why can at-least-once delivery create duplicates?', 'An acknowledgement can be lost after a consumer processes a message. The producer retries because it cannot tell whether processing succeeded.', ['queues']],
  ] },
  { title: 'JavaScript essentials', description: 'Small details. Better code. Stronger foundations.', color: 'orange', icon: 'code', visibility: 'global', tags: ['javascript', 'development'], cards: [
    ['What is a closure in JavaScript?', 'A closure is a function together with access to its lexical environment, even after the outer function has returned.', ['javascript']],
    ['What is the difference between === and ==?', 'Strict equality (===) compares without type coercion. Loose equality (==) can convert operand types before comparing.', ['basics']],
    ['How does Promise.all handle rejection?', 'It rejects as soon as any input promise rejects. The other operations are not automatically cancelled.', ['async']],
    ['What does the event loop do?', 'It coordinates executing queued tasks when the call stack is clear. Promise callbacks run as microtasks before the next task.', ['async']],
    ['What is a pure function?', 'A function that returns the same result for the same inputs and has no observable side effects.', ['functions']],
  ] },
  { title: 'Everyday Spanish', description: 'A few new words for your next adventure.', color: 'blue', icon: 'globe', visibility: 'private', tags: ['language', 'spanish'], cards: [
    ['How do you say “good morning” in Spanish?', 'Buenos días.', ['greetings']], ['What does “hasta luego” mean?', 'See you later.', ['greetings']], ['How do you ask “Where is the station?”', '¿Dónde está la estación?', ['travel']], ['What does “gracias” mean?', 'Thank you.', ['basics']],
  ] },
  { title: 'Design fundamentals', description: 'Principles for interfaces that feel effortless.', color: 'pink', icon: 'palette', visibility: 'global', tags: ['design', 'ux'], cards: [
    ['What is visual hierarchy?', 'The arrangement of elements to communicate their relative importance, using size, contrast, spacing, and position.', ['ui']], ['What is progressive disclosure?', 'Showing essential options first and revealing more detail when needed, reducing the initial cognitive load.', ['ux']], ['Why does accessible contrast matter?', 'It helps people distinguish text and controls, including people with low vision or those using a screen in bright light.', ['accessibility']], ['What is a design token?', 'A named value for a reusable design decision such as color, spacing, typography, or radius.', ['systems']],
  ] },
  { title: 'Learning how to learn', description: 'Make your study time go a little further.', color: 'green', icon: 'brain', visibility: 'global', tags: ['learning', 'memory'], cards: [
    ['What is active recall?', 'Trying to retrieve information from memory before looking at the answer.', ['memory']], ['What is spaced repetition?', 'Reviewing information at intervals over time, with the intervals adapted to how well you remember it.', ['memory']], ['What is interleaving?', 'Mixing related topics or problem types during practice, rather than working on only one type at a time.', ['practice']],
  ] },
  { title: 'Database concepts', description: 'Queries, transactions, and everything in between.', color: 'slate', icon: 'terminal', visibility: 'private', tags: ['databases', 'backend'], cards: [
    ['What does ACID stand for?', 'Atomicity, Consistency, Isolation, and Durability.', ['transactions']], ['What does a unique index guarantee?', 'It prevents two records from having the same indexed value or combination of values, subject to the index configuration.', ['indexes']], ['What is a replica set?', 'A group of database nodes that maintain copies of the same data. A primary accepts writes and secondary nodes replicate them.', ['replication']],
  ] }
];
