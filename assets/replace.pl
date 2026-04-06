open HEADER, "<header.txt";
@header_lines= <HEADER>;
@files = <*mishna.html>;

foreach $file (@files) {
	open INPUT,  "<$file";
	
open OUTPUT, ">$file.tmp";
print OUTPUT @header_lines;	
	while (($line=<INPUT>) && ($line!~ /div class=Section1 dir=LTR/)) {
		
	}
	while ($line=<INPUT>) {
		print OUTPUT $line;
	}
	close INPUT;
	close OUTPUT;

}