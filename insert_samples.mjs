import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://urizlizlbvpzlozcpghd.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaXpsaXpsYnZwemxvemNwZ2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTMwMjksImV4cCI6MjA5NDI2OTAyOX0.NLPEa5TK4cbjOxP7ZWawiLdUfFmEMas4BmcwOeUIbyM";
const supabase = createClient(supabaseUrl, supabaseKey);

// IMPORTANT: I still could not find the emails in the text you pasted (Google Forms does not include the email in the summary text if it's collected automatically).
// I have used your known email for Sibhi S, but please update the other 3 emails!
const sampleData = [
  {
    user_id: 'sample-uid-1',
    email: 'ilangkumaran.s2024@vitstudent.ac.in', // <-- CHANGE THIS
    full_name: 'Ilangkumaran S',
    roll_number: '24BMV1031',
    phone: '8668180796',
    primary_dept: 'Secretary',
    reason: `Q: What systems, tools, or workflows would you implement to ensure all meeting minutes, action items, deadlines, and official records are organized, accessible, and consistently maintained throughout the tenure?
A: I would always like to use the basic microsoft documentation tools such as word doc, ppt, and ms Excel. Also I'm very much well versed with the usage of google keep which can take the MoM of the meets. Also I would be very much comfortable using the folders to maintain my records.

Q: In your opinion, what qualities distinguish an exceptional Secretary from an average one? How would you ensure smooth communication and accountability across the entire board?
A: An average secretary would be a person who just documents and monitors the generalised means of the chapter. But a exceptional secretary would be a person who would affirmatively track the record revise the charter and also make proper step wise plans for the events and it's future documentation. Also a exceptional secretary should be definitely good with communication and also be good with maintaining a good positive relationship with the board members, leads and the club members.

Q: A major chapter event is just two days away. During the final review, the Chairperson realizes that the latest meeting minutes were never shared, several action items were not followed up on, and different departments have conflicting information about their responsibilities. As the Secretary, how would you handle the situation, restore coordination, and ensure the event proceeds successfully?
A: As the Secretary, I would immediately circulate the latest meeting minutes, prepare a clear summary of pending action items with assigned responsibilities and deadlines, and organize a quick coordination meeting with all department leads to resolve any confusion. I would maintain constant communication until the event to ensure every team is aligned and all critical tasks are completed on time.`,
    status: 'pending'
  },
  {
    user_id: 'sample-uid-2',
    email: 'neyalakshmi.2024@vitstudent.ac.in', // <-- CHANGE THIS
    full_name: 'NeyaLakshmi',
    roll_number: '24BPS1117',
    phone: '8438921458',
    primary_dept: 'Treasurer',
    reason: `Q: The Treasurer's role goes beyond maintaining accounts. How would you ensure that the chapter's funds are utilized efficiently while balancing ambitious initiatives with financial sustainability?
A: By imagining the worst case of outcome I'll source the income. By keeping track of all records i should be able to maintain the flow and balance. I'll also ensure that it's planned ahead to avoid any conflict.

Q: Imagine the chapter has a limited annual budget, but multiple departments have proposed high-impact events that together exceed the available funds. Explain how you would evaluate these proposals, prioritize funding, and justify your decisions to the board.
A: Priority from my end will be given to the department that has proven efficiency. I will make sure smooth flow of event occurs by rationalizing the fund. I prefer quality over quantity and hence the priority is to the team that produces the best outcome in many aspects after consideration with the board

Q: A week before the chapter's flagship event, a major sponsor unexpectedly withdraws their support, creating a significant budget shortfall. As the Treasurer, what immediate steps would you take to manage the crisis, minimize the impact on the event, and maintain transparency with the board and stakeholders?
A: By ensuring the budget is divided among all necessary parts of the event. I'll make sure that the situation is entirely transparent to avoid conflict. By dividing the fund with a priority to things that attract and draw attention the most, the impact of the things which have gone down due to the drawback could be drastically reduced. P`,
    secondary_dept: 'Secretary',
    secondary_reason: `Q: What systems, tools, or workflows would you implement to ensure all meeting minutes, action items, deadlines, and official records are organized, accessible, and consistently maintained throughout the tenure?
A: A seperate shared set of documents to keep track of all events and occurance will help everyone and myself as a secretary to ensure that the tenure is organised and everyone are clear with the timeline and it's easily accessible.

Q: In your opinion, what qualities distinguish an exceptional Secretary from an average one? How would you ensure smooth communication and accountability across the entire board?
A: Discipline and an exceptional ability to keep up to time. As a secretary it's important to ensure that people don't lose track of time and no time goes wasted in discussion or confusions that occur last minute.

Q: A major chapter event is just two days away...
A: The priority goes to everything that produces conflict. I'll make sure the next event happens with no further weigh downs from the confusion of previous events`,
    status: 'pending'
  },
  {
    user_id: 'sample-uid-3',
    email: 'sibhi.s2024@vitstudent.ac.in', // Extracted from DB / Known email
    full_name: 'Sibhi S',
    roll_number: '24BPS1104',
    phone: '9363931237',
    primary_dept: 'Chairperson',
    reason: `Q: The chapter has limited time, budget, and volunteers, but is expected to deliver impactful events throughout the year. How would you plan the chapter's roadmap, prioritize initiatives, and ensure consistent member engagement?
A: I would prioritize high impact events instead of smaller events, delegate works thru smaller teams than larger teams which ensure all the members will be accountable for their work and will work interactively and maintain regular feedback and communications to keep member from feeling left out or lost

Q: Imagine the board is divided over an important decision (e.g., budget allocation, event direction, or collaborations), causing delays and conflict. How would you resolve the situation while maintaining transparency, fairness, and team morale?
A: I would encourage everyone to openly discuss on all possible ways and evaluate the options and choose the best one which align with our chapter's goal. Once, i finalized the decision i would make sure everyone understand the reason and make sure everyone works on it together instead of splitting up on different ideologies

Q: If selected as Chairperson, what would be your vision for the IEEE SSCS Chapter over the next one year? Describe the initiatives, culture, partnerships, and measurable outcomes you would aim to achieve, and explain how you would turn that vision into reality.
A: My vision for the next tenure of IEEE SSCS is to make it more than a club for the members, it should be a community where every member feels included and part of a family. Ill put my maximum effort to build a active and collaborative culture out of ieee sscs and organize impactful events and nurture a project based environment for the members. My ultimate goal is to lead the chapter to become the best performing technical chapter in VIT Chennai and earn the Best Technical Club award.`,
    secondary_dept: 'Vice Chairperson',
    secondary_reason: `Q: The Vice Chairperson is responsible for ensuring that plans are executed effectively across multiple departments. Describe how you would monitor progress, identify bottlenecks, and keep teams accountable without micromanaging them.
A: I would set clear goals and timelines, hold regular check-ins with department leads, and track progress through updates rather than constant supervision. If bottlenecks arise, I would help resolve them quickly while giving teams the freedom to work independently and stay accountable

Q: Imagine the Chairperson is unavailable during a critical phase of an event, and multiple departments are facing last-minute issues. Explain how you would take charge, prioritize decisions, delegate responsibilities, and ensure the event is executed successfully.
A: I would stay calm, assess the most critical issues first, and delegate responsibilities to the respective department leads based on priority

Q: What do you believe is the role of a Vice Chairperson beyond simply assisting the Chairperson? Describe how you would contribute to strengthening the chapter's operations, leadership, and long-term growth while maintaining effective collaboration with the Chairperson and the rest of the board.
A: Beyond assisting the Chairperson, I believe a Vice Chairperson should connect departments, solve problems actively and ensure ideas become results. I would promote collaboration, support members and help build a stronger and sustainable chapter`,
    status: 'pending'
  },
  {
    user_id: 'sample-uid-4',
    email: 'karthikeyan.d2025@vitstudent.ac.in', // <-- CHANGE THIS
    full_name: 'Karthikeyan D',
    roll_number: '25BEC1603',
    phone: '7904722098',
    primary_dept: 'Technical',
    reason: `Q: Describe your most significant technical project
A: Smart helmet with IoT integration using esp32, in this we created our own app that connects to esp32 via Bluetooth and if crash is detected it sends sms automatically to the emergency number and also we integrated ignition control system which turns off the engine when alcohol level is high rather traditional ways of using Arduino nd gsm modules which consumes more power and requires space where our framework and structure is designed to reduce the power consumption and space in the helmet without compromising the safety of the rider

Q: Imagine you're organizing a workshop on a technology you're not familiar with. How would you prepare and ensure the event is successful?
A: I will prepare using ai tools like chatgpt, gemini and also if I have doubts I will clarify from seniors so that I will ensure that the event is not disturbed and also deliver the concept in clear to everyone

Q: What technical skills or experience make you a strong candidate for the Technical Lead position? Why should we choose you?
A: Pcb designing, ai automation, hardware and software integrations are my best skills and my ability to work with team to give my best to project or event or workshop and i will make sure that everything is going smooth`,
    secondary_dept: 'Creative',
    secondary_reason: `Q: You receive a request to design an event poster that must be completed within 24 hours, but the event details are incomplete. How would you handle the situation?
A: I will further ask them about details or I will try gather as much information as I can from all the resources through my connections, so that I will make sure everything is shown in the event.

Q: How would you ensure that all IEEE SSCS posters, social media posts, and promotional materials maintain a consistent and professional brand identity?
A: We have strong branding IEEE, so I will make sure that ieee and this sscs chapter will be registered to all the students with its poster by designing the posters in unique way than the other clubs

Q: You have to promote an event with a limited budget and only social media as your platform. What creative strategies would you use to maximize reach and engagement?
A: First as a lead I will assign works to everyone to create a unique posters and I will select the best eye catching poster and I will communicate to the outreach department to post the poster in Instagram, linkedin and WhatsApp etc. and also I recommend them to market our event in hostels and before Ab-1 about our program`,
    status: 'pending'
  }
];

async function insertSamples() {
  await supabase.from('applications').delete().in('user_id', ['sample-uid-1', 'sample-uid-2', 'sample-uid-3', 'sample-uid-4', 'sample-uid-5']);

  const { data, error } = await supabase.from('applications').insert(sampleData).select();
  if (error) {
    console.error('Error inserting sample records:', error);
  } else {
    console.log('Successfully inserted sample records:', data.map(d => d.email));
  }
}

insertSamples();
