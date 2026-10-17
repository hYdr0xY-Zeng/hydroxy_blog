INSERT INTO documents(id,kind,path,source_path,title,body_markdown,status) VALUES
('index-md','learn','notes/index-md','src/content/learn/01-notes/01-index-md/index.md','Index MD','Intro with no children','published'),
('index-mdx','learn','notes/index-mdx','src/content/learn/01-notes/02-index-mdx/index.mdx','Index MDX','MDX intro with no children','draft'),
('parent','learn','notes/parent','src/content/learn/01-notes/03-parent.md','Legacy parent','Parent body must survive','published'),
('child','learn','notes/parent/child','src/content/learn/01-notes/03-parent/01-child.md','Child','Child body','published'),
('leaf','learn','notes/leaf','src/content/learn/01-notes/04-leaf.md','Leaf','Leaf body','published'),
('named-index','learn','notes/named-index','src/content/learn/01-notes/05-named-index.md','Not an index','Filename suffix is not index.md','published'),
('online','learn','notes/online',NULL,'Online article','No source path','archived'),
('windows-index','learn','notes/windows-index','src\content\learn\01-notes\06-windows-index\INDEX.MD','Windows index','Windows source path','published');

INSERT INTO learn_nodes(path,parent_path,label,sort_order,document_id) VALUES
('notes',NULL,'Original Notes',1,NULL),
('notes/index-md','notes','Original index label',2,'index-md'),
('notes/index-mdx','notes','Original MDX label',3,'index-mdx'),
('notes/parent','notes','Original parent label',4,'parent'),
('notes/parent/child','notes/parent','Original child label',5,'child'),
('notes/leaf','notes','Original leaf label',6,'leaf'),
('notes/named-index','notes','Named index',7,'named-index'),
('notes/online','notes','Online article',8,'online'),
('notes/empty','notes','Empty directory',9,NULL),
('notes/windows-index','notes','Windows index directory',10,'windows-index');

INSERT INTO redirects(from_path,to_path) VALUES('/learn/old-leaf/','/learn/notes/leaf/');
