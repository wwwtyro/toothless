if [ ! -e /usr/lib/apt/methods/https ]; then
    apt-get update
    apt-get install -y apt-transport-https
fi

echo deb https://get.docker.com/ubuntu docker main > /etc/apt/sources.list.d/docker.list
add-apt-repository "deb http://get.toothless.rocks/ toothless main"

apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 36A1D7869245C8950F966E92D8576A8BA88D21E9
apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 6CFCE259

apt-get update
apt-get install -y lxc-docker-1.5.0 
apt-get install -y toothless



